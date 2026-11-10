import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { sendVerificationEmail, sendCollegeVerificationEmail } from "../email/resendService.js";
import { sendVerificationSms, normalizePhoneNumber } from "../sms/smsGatewayService.js";
import { cloudinary, isCloudinaryConfigured, DEFAULT_VERIFICATION_FOLDER } from "../../config/cloudinary.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";
import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";
import { CollegeOcrService, type OcrExtractedData } from "./collegeOcrService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INSECURE_PROXY_SECRETS = new Set([
    "",
    "orbix_secret_fallback_key_2026",
    "orbix_jwt_secret_fallback_2026",
    "your_jwt_secret_key_here",
    "your_document_proxy_hmac_secret",
    "your_document_proxy_hmac_secret_here_minimum_32_characters",
    "changeme",
    "secret",
    "default_secret",
]);
const MIN_PRODUCTION_PROXY_SECRET_LENGTH = 32;

// Process-scoped ephemeral key reserved strictly for unconfigured non-production development runs.
let devOnlyEphemeralProxySecret: string | null = null;
let devProxyNoticeLogged = false;

/**
 * Resolves the dedicated DOCUMENT_PROXY_HMAC_SECRET for local document-proxy tokens.
 * Never reuses JWT_SECRET. Fails closed in production if absent, placeholder, or < 32 chars.
 */
export function getDocumentProxySigningSecret(): string {
    const raw = process.env.DOCUMENT_PROXY_HMAC_SECRET?.trim() || "";
    const isProduction = process.env.NODE_ENV === "production";
    const lower = raw.toLowerCase();
    const isPlaceholder =
        INSECURE_PROXY_SECRETS.has(lower) || lower.includes("your_document_proxy");

    if (isProduction) {
        if (!raw || isPlaceholder || raw.length < MIN_PRODUCTION_PROXY_SECRET_LENGTH) {
            const err: any = new Error(
                "Document proxy signing configuration error: A strong DOCUMENT_PROXY_HMAC_SECRET environment variable (minimum 32 characters) is required in production."
            );
            err.statusCode = 500;
            err.isConfigError = true;
            throw err;
        }
        return raw;
    }

    if (raw && !isPlaceholder) {
        return raw;
    }

    if (!devOnlyEphemeralProxySecret) {
        devOnlyEphemeralProxySecret = crypto.randomBytes(32).toString("hex");
    }
    if (!devProxyNoticeLogged) {
        devProxyNoticeLogged = true;
        console.warn(
            "[CollegeVerification] NOTICE: DOCUMENT_PROXY_HMAC_SECRET is not configured; using an ephemeral development-only per-process HMAC secret (disallowed in production)."
        );
    }
    return devOnlyEphemeralProxySecret;
}

/**
 * Resolves and validates canonical frontend URL for verification links.
 * Requires explicit HTTPS origin in production; permits localhost in development.
 */
export function getCanonicalFrontendUrl(): string {
    const raw = process.env.FRONTEND_URL?.trim();
    const isProduction = process.env.NODE_ENV === "production";

    if (raw) {
        try {
            const parsed = new URL(raw);
            if (isProduction && parsed.protocol !== "https:") {
                throw new Error("FRONTEND_URL must use the HTTPS protocol in production.");
            }
            return raw.replace(/\/+$/, "");
        } catch (err: any) {
            if (isProduction) {
                throw new Error(`Invalid FRONTEND_URL configured in production: ${err.message}`);
            }
        }
    }

    if (isProduction) {
        throw new Error(
            "FRONTEND_URL environment variable is required in production (e.g. https://orbix.dev)."
        );
    }

    return "http://localhost:5173";
}

const LOCAL_UPLOAD_DIR = path.resolve(__dirname, "../../../uploads/college_verifications");

// Ensure local private storage folder exists
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

export interface StoredDocument {
    storage: "cloudinary" | "local";
    publicId?: string;
    filename?: string;
    originalName: string;
    mimeType: string;
    size: number;
    format: string;
    uploadedAt: string;
}

export interface SubmitApplicationDeps {
    query?: ((text: string, params?: any[]) => Promise<any>) | undefined;
    pool?: {
        connect: () => Promise<{
            query: (text: string, params?: any[]) => Promise<any>;
            release: () => void;
        }>;
    } | undefined;
    client?: {
        query: (text: string, params?: any[]) => Promise<any>;
        release?: () => void;
    } | undefined;
    uploader?: {
        upload_stream: (options: any, callback: (error: any, result: any) => void) => any;
        destroy: (publicId: string, options: any) => Promise<any>;
    } | undefined;
    isCloudinaryConfigured?: (() => boolean) | undefined;
}

export interface VerificationChannelDeps {
    query?: ((text: string, params?: any[]) => Promise<any>) | undefined;
    emailSender?: ((options: {
        to: string;
        studentName: string;
        collegeName: string;
        verificationLink: string;
        expiresInHours?: number;
    }) => Promise<any>) | undefined;
    smsSender?: ((options: {
        to: string;
        otp: string;
        clubName?: string;
    }) => Promise<any>) | undefined;
    skipRateLimit?: boolean | undefined;
}

export interface ApproveApplicationDeps {
    pool?: {
        connect: () => Promise<{
            query: (text: string, params?: any[]) => Promise<any>;
            release: () => void;
        }>;
        query?: (text: string, params?: any[]) => Promise<any>;
    };
    client?: {
        query: (text: string, params?: any[]) => Promise<any>;
        release?: () => void;
    };
    query?: (text: string, params?: any[]) => Promise<any>;
    cache?: {
        deleteUserDetailsCache?: (userId: string) => Promise<any>;
        invalidateAllUserCaches?: (user: { username: string; id: string }) => Promise<any>;
    };
    notificationHook?: (application: any) => Promise<void>;
    auditHook?: (event: {
        action: string;
        applicationId: string;
        userId: string;
        reviewerId: string;
        status: string;
        timestamp: Date;
    }) => Promise<void>;
}

export class CollegeVerificationService {
    /**
     * Retrieves current verification state, active submission, and submission history for a student.
     */
    public static async getStatus(userId: string, deps?: VerificationChannelDeps) {
        const activeQuery = deps?.query || query;

        // 1. Fetch user's currently linked college
        const userRes = await activeQuery(
            `SELECT u.id, u.college_id, u.college, u.college_updated_at,
                    i.id AS "instId", i.official_name AS "instName", i.city, i.state, i.aishe_code AS "aisheCode", i.website
             FROM users u
             LEFT JOIN institutions i ON u.college_id = i.id
             WHERE u.id = $1 LIMIT 1;`,
            [userId]
        );

        const userRow = userRes.rows[0];
        if (!userRow) {
            throw new Error("User account not found");
        }

        const currentCollege = userRow.college_id
            ? {
                  id: userRow.instId || userRow.college_id,
                  officialName: userRow.instName || userRow.college,
                  city: userRow.city,
                  state: userRow.state,
                  aisheCode: userRow.aisheCode,
                  website: userRow.website,
              }
            : null;

        // 2. Query all verification submissions for this user (most recent first)
        const appsRes = await activeQuery(
            `SELECT cv.*, 
                    i.official_name AS "collegeName", i.city AS "collegeCity", i.state AS "collegeState",
                    reviewer.username AS "reviewerUsername"
             FROM college_verifications cv
             LEFT JOIN institutions i ON cv.college_id = i.id
             LEFT JOIN users reviewer ON cv.reviewed_by = reviewer.id
             WHERE cv.user_id = $1
             ORDER BY cv.created_at DESC;`,
            [userId]
        );

        const allApplications = appsRes.rows.map((row: any) => this.formatApplicationRow(row, false));

        // 3. Determine authoritative state
        // A user is APPROVED if and only if there is an APPROVED record matching their CURRENT college
        const approvedRecord = allApplications.find(
            (a: any) => a.status === "APPROVED" && currentCollege && a.college_id === currentCollege.id
        );

        let logicalStatus: "NOT_VERIFIED" | "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "INVALIDATED" = "NOT_VERIFIED";
        let activeApplication: any = null;
        let latestApplication: any = allApplications[0] || null;

        if (approvedRecord) {
            logicalStatus = "APPROVED";
            activeApplication = approvedRecord;
        } else {
            // Check for pending/processing active submission
            const pendingRecord = allApplications.find(
                (a: any) => a.status === "PENDING" || a.status === "PROCESSING"
            );
            if (pendingRecord) {
                logicalStatus = pendingRecord.status as "PENDING" | "PROCESSING";
                activeApplication = pendingRecord;
            } else if (latestApplication && latestApplication.status === "INVALIDATED") {
                logicalStatus = "INVALIDATED";
            } else if (latestApplication && latestApplication.status === "REJECTED") {
                logicalStatus = "REJECTED";
            } else {
                logicalStatus = "NOT_VERIFIED";
            }
        }

        // 4. Query unclaimed pre-submission verified email & phone belonging to this user
        let preVerifiedEmail: { institution_email: string; verified_at: any } | null = null;
        let preVerifiedPhone: { phone: string; verified_at: any } | null = null;

        if (!activeApplication) {
            const emailRes = await activeQuery(
                `SELECT institution_email, verified_at
                 FROM college_verification_email_tokens
                 WHERE user_id = $1 AND status = 'verified' AND verification_id IS NULL
                 ORDER BY verified_at DESC
                 LIMIT 1;`,
                [userId]
            );
            if (emailRes.rows[0]?.verified_at) {
                preVerifiedEmail = emailRes.rows[0];
            }

            const phoneRes = await activeQuery(
                `SELECT phone, verified_at
                 FROM college_verification_phone_otps
                 WHERE user_id = $1 AND status = 'verified' AND verification_id IS NULL
                 ORDER BY verified_at DESC
                 LIMIT 1;`,
                [userId]
            );
            if (phoneRes.rows[0]?.verified_at) {
                preVerifiedPhone = phoneRes.rows[0];
            }
        }

        return {
            success: true,
            status: logicalStatus,
            isCollegeVerified: logicalStatus === "APPROVED",
            currentCollege,
            activeApplication,
            latestApplication,
            history: allApplications,
            verifiedChannels: {
                email: preVerifiedEmail?.institution_email || activeApplication?.institution_email || null,
                emailVerifiedAt: preVerifiedEmail?.verified_at || activeApplication?.email_verified_at || null,
                phone: preVerifiedPhone?.phone || activeApplication?.phone_number || null,
                phoneVerifiedAt: preVerifiedPhone?.verified_at || activeApplication?.phone_verified_at || null,
            },
        };
    }

    /**
     * Submits a new College Verification application.
     */
    public static async submitApplication(params: {
        userId: string;
        collegeId: string;
        documentType: "student_id" | "erp_profile" | "student_id_both_sides";
        files: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>;
        extractedData?: OcrExtractedData;
        studentName?: string | null;
        enrollmentNumber?: string | null;
        courseName?: string | null;
        academicYear?: string | null;
        institutionEmail?: string | null;
        phoneNumber?: string | null;
        ocrConfidence?: number;
    }, deps?: SubmitApplicationDeps) {
        const {
            userId,
            collegeId,
            documentType,
            files,
            extractedData = {
                studentName: null,
                collegeName: null,
                enrollmentNumber: null,
                courseName: null,
                academicYear: null,
                institutionEmail: null,
                phoneNumber: null,
            },
            studentName,
            enrollmentNumber,
            courseName,
            academicYear,
            institutionEmail,
            phoneNumber,
            ocrConfidence = 0,
        } = params;

        const activeQuery = deps?.client
            ? (text: string, params?: any[]) => deps.client!.query(text, params)
            : (deps?.query || query);

        // 1. Validation: files required
        if (!files || files.length === 0) {
            const err: any = new Error("Please upload at least one valid document image (ID card or ERP screenshot).");
            err.statusCode = 400;
            throw err;
        }

        if (documentType === "student_id_both_sides" && files.length < 2) {
            const err: any = new Error("Front and back ID card images are required for two-sided submissions.");
            err.statusCode = 400;
            throw err;
        }

        // 2. Mandatory input validation: institutional email and phone number
        const cleanEmail = typeof institutionEmail === "string" ? institutionEmail.trim().toLowerCase() : "";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!cleanEmail || !emailRegex.test(cleanEmail)) {
            const err: any = new Error(
                "A verified institutional email address is required before submitting your application."
            );
            err.statusCode = 400;
            throw err;
        }

        const cleanPhoneInput = typeof phoneNumber === "string" ? phoneNumber.trim() : "";
        const normPhone = normalizePhoneNumber(cleanPhoneInput);
        if (!cleanPhoneInput || !normPhone.isValid) {
            const err: any = new Error(
                "A verified 10-digit mobile phone number is required before submitting your application."
            );
            err.statusCode = 400;
            throw err;
        }

        // 3. Validate user, student eligibility (exclude clubs), and college alignment
        const userRes = await activeQuery(`SELECT id, college_id, account_type FROM users WHERE id = $1 LIMIT 1;`, [userId]);
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found");
            err.statusCode = 404;
            throw err;
        }

        if (user.account_type === "club") {
            const err: any = new Error(
                "Club accounts have a dedicated club verification workflow and cannot submit student college verification."
            );
            err.statusCode = 403;
            throw err;
        }

        if (!user.college_id || user.college_id !== collegeId) {
            const err: any = new Error(
                "The selected institution does not match your currently saved profile college. Please update and save your college in Profile first."
            );
            err.statusCode = 400;
            throw err;
        }

        // 4. Verify institution exists
        const instRes = await activeQuery(`SELECT id, official_name, website FROM institutions WHERE id = $1 LIMIT 1;`, [collegeId]);
        if (!instRes.rows[0]) {
            const err: any = new Error("Selected institution was not found in directory.");
            err.statusCode = 404;
            throw err;
        }

        // 5. Duplicate active submission check
        const activeRes = await activeQuery(
            `SELECT id, status FROM college_verifications 
             WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING') 
             LIMIT 1;`,
            [userId]
        );
        if (activeRes.rows[0]) {
            const err: any = new Error(
                "You already have a college verification application under review. Please wait for the review decision."
            );
            err.statusCode = 409;
            throw err;
        }

        // 6. Mandatory server-side verification checks (never trust client flags or timestamps)
        const tokenRes = await activeQuery(
            `SELECT id, institution_email, verified_at
             FROM college_verification_email_tokens
             WHERE user_id = $1
               AND LOWER(institution_email) = LOWER($2)
               AND status = 'verified'
               AND verification_id IS NULL
             ORDER BY verified_at DESC LIMIT 1;`,
            [userId, cleanEmail]
        );
        const verifiedEmailRow = tokenRes.rows[0];
        if (!verifiedEmailRow || !verifiedEmailRow.verified_at) {
            const err: any = new Error(
                "Institutional email verification is incomplete. Please verify the confirmation link sent to your institutional email before submitting."
            );
            err.statusCode = 400;
            throw err;
        }

        const phoneRes = await activeQuery(
            `SELECT id, phone, verified_at
             FROM college_verification_phone_otps
             WHERE user_id = $1
               AND phone = $2
               AND status = 'verified'
               AND verification_id IS NULL
             ORDER BY verified_at DESC LIMIT 1;`,
            [userId, normPhone.canonical]
        );
        const verifiedPhoneRow = phoneRes.rows[0];
        if (!verifiedPhoneRow || !verifiedPhoneRow.verified_at) {
            const err: any = new Error(
                "Mobile phone OTP verification is incomplete. Please verify your phone number with the 6-digit SMS code before submitting."
            );
            err.statusCode = 400;
            throw err;
        }

        const emailVerifiedAt: Date = verifiedEmailRow.verified_at;
        const phoneVerifiedAt: Date = verifiedPhoneRow.verified_at;

        // 7. Secure document upload with automatic rollback on partial/database failure
        const storedDocs: StoredDocument[] = [];
        try {
            for (const file of files) {
                const val = CollegeOcrService.validateImageBuffer(file.buffer);
                if (!val.isValid) {
                    const err: any = new Error(val.error || "Invalid file format");
                    err.statusCode = 400;
                    throw err;
                }

                const doc = await this.savePrivateDocument(
                    file.buffer,
                    file.originalname,
                    val.format || "jpg",
                    deps?.uploader,
                    deps?.isCloudinaryConfigured
                );
                storedDocs.push(doc);
            }

            // 8. Atomically insert application and claim both verified tokens for this application
            const useTransaction = Boolean(deps?.client || deps?.pool || !deps?.query);
            const isExternalClient = Boolean(deps?.client);
            let txClient: { query: (text: string, params?: any[]) => Promise<any>; release?: () => void } | null = null;

            if (useTransaction) {
                txClient = deps?.client
                    ? deps.client
                    : await (deps?.pool || pool).connect();
            }

            const runTxQuery = txClient
                ? (text: string, params?: any[]) => txClient!.query(text, params)
                : activeQuery;

            let created: any;
            try {
                if (txClient) {
                    await txClient.query("BEGIN;");
                }

                const insertRes = await runTxQuery(
                    `INSERT INTO college_verifications (
                        user_id,
                        college_id,
                        status,
                        document_type,
                        document_paths,
                        extracted_data,
                        student_name,
                        enrollment_number,
                        course_name,
                        academic_year,
                        institution_email,
                        email_verified_at,
                        phone_number,
                        phone_verified_at,
                        ocr_confidence
                     ) VALUES ($1, $2, 'PENDING', $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                     RETURNING *;`,
                    [
                        userId,
                        collegeId,
                        documentType,
                        JSON.stringify(storedDocs),
                        JSON.stringify(extractedData || {}),
                        studentName || extractedData?.studentName || null,
                        enrollmentNumber || extractedData?.enrollmentNumber || null,
                        courseName || extractedData?.courseName || null,
                        academicYear || extractedData?.academicYear || null,
                        cleanEmail,
                        emailVerifiedAt,
                        normPhone.canonical,
                        phoneVerifiedAt,
                        ocrConfidence,
                    ]
                );

                created = insertRes.rows[0];
                if (!created?.id) {
                    throw new Error("Failed to persist college verification application.");
                }

                // Bind verified email token to this specific application so it cannot be reused
                const claimEmailRes = await runTxQuery(
                    `UPDATE college_verification_email_tokens
                     SET verification_id = $1
                     WHERE id = $2 AND user_id = $3 AND status = 'verified' AND verification_id IS NULL
                     RETURNING id;`,
                    [created.id, verifiedEmailRow.id, userId]
                );
                if (!claimEmailRes.rows?.[0]) {
                    const err: any = new Error(
                        "Institutional email verification has already been claimed by another submission. Please verify your email again."
                    );
                    err.statusCode = 409;
                    throw err;
                }

                // Bind verified phone OTP to this specific application so it cannot be reused
                const claimPhoneRes = await runTxQuery(
                    `UPDATE college_verification_phone_otps
                     SET verification_id = $1
                     WHERE id = $2 AND user_id = $3 AND status = 'verified' AND verification_id IS NULL
                     RETURNING id;`,
                    [created.id, verifiedPhoneRow.id, userId]
                );
                if (!claimPhoneRes.rows?.[0]) {
                    const err: any = new Error(
                        "Mobile phone verification has already been claimed by another submission. Please verify your phone OTP again."
                    );
                    err.statusCode = 409;
                    throw err;
                }

                if (txClient) {
                    await txClient.query("COMMIT;");
                }
            } catch (dbErr) {
                if (txClient) {
                    try {
                        await txClient.query("ROLLBACK;");
                    } catch {}
                }
                throw dbErr;
            } finally {
                if (!isExternalClient && txClient && typeof txClient.release === "function") {
                    txClient.release();
                }
            }

            return {
                success: true,
                message: "College verification application submitted successfully. Orbix founders will review your submission.",
                application: this.formatApplicationRow(created, false),
            };
        } catch (submissionErr: any) {
            // Clean up all newly uploaded documents created during this attempt
            if (storedDocs.length > 0) {
                console.warn(
                    `[CollegeVerification] Submission failed: ${submissionErr?.message || "error"}. Cleaning up ${storedDocs.length} newly uploaded asset(s)...`
                );
                await this.cleanupUploadedDocuments(storedDocs, deps?.uploader);
            }
            throw submissionErr;
        }
    }

    /**
     * Dispatches a single-use verification link to student's institutional email.
     */
    public static async sendInstitutionalEmailToken(params: {
        userId: string;
        email: string;
        collegeId: string;
        ipAddress?: string;
        userAgent?: string;
    }, deps?: VerificationChannelDeps) {
        const { userId, email, collegeId, ipAddress = "unknown", userAgent = "unknown" } = params;
        const activeQuery = deps?.query || query;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            const err: any = new Error("Please provide a valid institutional email address.");
            err.statusCode = 400;
            throw err;
        }

        // 2. Validate student eligibility and college alignment
        const userCheckRes = await activeQuery(
            `SELECT id, college_id, account_type, firstname, lastname, username FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const userRow = userCheckRes.rows[0];
        if (!userRow) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }
        if (userRow.account_type === "club") {
            const err: any = new Error("Club accounts cannot request student college email verification.");
            err.statusCode = 403;
            throw err;
        }
        if (!userRow.college_id || userRow.college_id !== collegeId) {
            const err: any = new Error(
                "Selected college must match your saved profile college before sending verification email."
            );
            err.statusCode = 400;
            throw err;
        }

        // 3. Fetch institution and check domain association where available
        const instRes = await activeQuery(`SELECT id, official_name, website FROM institutions WHERE id = $1 LIMIT 1;`, [collegeId]);
        const inst = instRes.rows[0];
        if (!inst) {
            const err: any = new Error("Selected institution was not found in directory.");
            err.statusCode = 404;
            throw err;
        }

        let domainMatched = false;
        let instDomain = "";

        if (inst?.website) {
            try {
                const parsedUrl = new URL(inst.website.startsWith("http") ? inst.website : `https://${inst.website}`);
                instDomain = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
                const parts = normalizedEmail.split("@");
                const emailDomain = (parts[1] || "").toLowerCase();
                if (emailDomain === instDomain || emailDomain.endsWith(`.${instDomain}`)) {
                    domainMatched = true;
                }
            } catch {
                // Ignore website parse errors
            }
        }

        // 4. Rate limiting via Redis
        if (!deps?.skipRateLimit && redis && redis.status === "ready") {
            const cooldownKey = `college_email_cooldown:${userId}`;
            const ttl = await redis.ttl(cooldownKey);
            if (ttl > 0) {
                const err: any = new Error(`Please wait ${ttl} seconds before requesting another verification email.`);
                err.statusCode = 429;
                err.cooldownRemainingSeconds = ttl;
                throw err;
            }

            const hourlyKey = `college_email_hourly:${userId}`;
            const count = await redis.incr(hourlyKey);
            if (count === 1) await redis.expire(hourlyKey, 3600);
            if (count > 5) {
                const err: any = new Error("Hourly email verification request limit reached (5/hr). Please try again later.");
                err.statusCode = 429;
                throw err;
            }
            await redis.set(cooldownKey, "1", "EX", 60);
        }

        // 5. Resolve canonical URL before expiring/inserting tokens so production misconfig fails cleanly
        const frontendBase = getCanonicalFrontendUrl();

        // 6. Generate secure token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Invalidate prior pending tokens for this user
        await activeQuery(
            `UPDATE college_verification_email_tokens 
             SET status = 'expired' 
             WHERE user_id = $1 AND status = 'pending';`,
            [userId]
        );

        let activeVerificationId: string | null = null;
        try {
            const vRes = await activeQuery(
                `SELECT id FROM college_verifications WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING') LIMIT 1;`,
                [userId]
            );
            if (vRes.rows[0]) {
                activeVerificationId = vRes.rows[0].id;
            }
        } catch {}

        const insertTokenRes = await activeQuery(
            `INSERT INTO college_verification_email_tokens (
                user_id, verification_id, institution_email, token_hash, status, expires_at
             ) VALUES ($1, $2, $3, $4, 'pending', $5)
             RETURNING id;`,
            [userId, activeVerificationId, normalizedEmail, tokenHash, expiresAt]
        );
        const insertedTokenId = insertTokenRes?.rows?.[0]?.id;

        // 7. Send Institutional Verification Email via Resend / SMTP (fail closed on error or prod simulation)
        const verificationLink = `${frontendBase}/profile?verify_college_email=${rawToken}`;
        const collegeName = inst?.official_name || "your institution";

        const full = [userRow.firstname, userRow.lastname].filter(Boolean).join(" ");
        const studentDisplayName = full || userRow.username || "Student";

        const activeEmailSender = deps?.emailSender || sendCollegeVerificationEmail;
        const isProduction = process.env.NODE_ENV === "production";
        let emailResult: any = null;
        let emailDispatchError: any = null;

        try {
            emailResult = await activeEmailSender({
                to: normalizedEmail,
                studentName: studentDisplayName,
                collegeName,
                verificationLink,
                expiresInHours: 24,
            });
        } catch (emailErr: any) {
            emailDispatchError = emailErr;
        }

        const simulatedInProduction = isProduction && emailResult?.simulated === true;
        const deliveryFailed =
            Boolean(emailDispatchError) ||
            emailResult?.success === false ||
            simulatedInProduction;

        if (deliveryFailed) {
            // Roll back unused pending token & cooldown so failed dispatch does not leave stale active state
            if (insertedTokenId) {
                try {
                    await activeQuery(
                        `UPDATE college_verification_email_tokens SET status = 'expired' WHERE id = $1;`,
                        [insertedTokenId]
                    );
                } catch {}
            }
            if (!deps?.skipRateLimit && redis && redis.status === "ready") {
                try {
                    await redis.del(`college_email_cooldown:${userId}`);
                } catch {}
            }

            const rawEmailErr = simulatedInProduction
                ? "Simulated institutional email delivery is prohibited in production."
                : emailDispatchError?.message ||
                  emailResult?.error ||
                  "Failed to dispatch institutional verification email.";
            const safeMsg = String(rawEmailErr)
                .split(rawToken).join("[REDACTED]")
                .split(verificationLink).join("[REDACTED]");
            console.error("[CollegeVerification] Email delivery failed (token redacted):", safeMsg);

            const err: any = new Error(
                "Unable to send verification link to your institutional email right now. Please try again later."
            );
            err.statusCode = isProduction && (!emailResult?.provider || simulatedInProduction) ? 503 : 502;
            throw err;
        }

        return {
            success: true,
            message: `Verification link sent to ${normalizedEmail}. Please check your inbox and click the link within 24 hours.`,
            domainMatched,
            matchedDomain: instDomain || null,
            cooldownSeconds: 60,
        };
    }

    /**
     * Verifies the institutional email link token.
     */
    public static async verifyInstitutionalEmailToken(
        token: string,
        userId?: string,
        verificationId?: string,
        deps?: VerificationChannelDeps
    ) {
        const activeQuery = deps?.query || query;

        if (!userId || typeof userId !== "string") {
            const err: any = new Error("Authentication is required to verify your institutional email link.");
            err.statusCode = 401;
            throw err;
        }

        if (!token || typeof token !== "string") {
            const err: any = new Error("Verification token is required.");
            err.statusCode = 400;
            throw err;
        }

        const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

        const tokenRes = await activeQuery(
            `SELECT id, user_id, verification_id, institution_email, status, expires_at 
             FROM college_verification_email_tokens 
             WHERE token_hash = $1 
             LIMIT 1;`,
            [tokenHash]
        );

        const row = tokenRes.rows[0];
        if (!row) {
            const err: any = new Error("Verification token is invalid.");
            err.statusCode = 400;
            throw err;
        }

        // Strict user ownership check before exposing status or mutating token
        if (row.user_id !== userId) {
            const err: any = new Error("This verification token belongs to a different user account.");
            err.statusCode = 403;
            throw err;
        }

        if (row.status === "verified") {
            const err: any = new Error("Verification token has already been used.");
            err.statusCode = 400;
            throw err;
        }

        if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
            if (row.status !== "expired") {
                await activeQuery(`UPDATE college_verification_email_tokens SET status = 'expired' WHERE id = $1;`, [row.id]);
            }
            const err: any = new Error("Verification token has expired. Please request a new verification email.");
            err.statusCode = 400;
            throw err;
        }

        // Validate verification application binding if verificationId is provided and token is bound
        if (verificationId && row.verification_id && row.verification_id !== verificationId) {
            const err: any = new Error("This verification token belongs to a different verification application.");
            err.statusCode = 403;
            throw err;
        }

        const verifiedAt = new Date();

        // Mark token verified atomically to prevent concurrent race conditions
        const updateTokenRes = await activeQuery(
            `UPDATE college_verification_email_tokens 
             SET status = 'verified', verified_at = $1 
             WHERE id = $2 AND status = 'pending'
             RETURNING id;`,
            [verifiedAt, row.id]
        );

        if (!updateTokenRes.rows[0]) {
            const err: any = new Error("Verification token has already been used.");
            err.statusCode = 400;
            throw err;
        }

        // If user has an active or pending verification, update its institutional email state
        await activeQuery(
            `UPDATE college_verifications 
             SET institution_email = $1, email_verified_at = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = $3 AND status IN ('PENDING', 'PROCESSING');`,
            [row.institution_email, verifiedAt, row.user_id]
        );

        return {
            success: true,
            message: `Institutional email (${row.institution_email}) has been verified successfully!`,
            email: row.institution_email,
            verifiedAt: verifiedAt.toISOString(),
        };
    }

    /**
     * Dispatches an SMS verification code to student's phone.
     */
    public static async sendPhoneOtp(params: {
        userId: string;
        phone: string;
        ipAddress?: string;
        userAgent?: string;
    }, deps?: VerificationChannelDeps) {
        const { userId, phone, ipAddress = "unknown", userAgent = "unknown" } = params;
        const activeQuery = deps?.query || query;
        const norm = normalizePhoneNumber(phone);

        if (!norm.isValid) {
            const err: any = new Error("Please enter a valid 10-digit mobile phone number.");
            err.statusCode = 400;
            throw err;
        }

        // Verify student eligibility (exclude clubs)
        const userRes = await activeQuery(`SELECT id, account_type FROM users WHERE id = $1 LIMIT 1;`, [userId]);
        const userRow = userRes.rows[0];
        if (!userRow) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }
        if (userRow.account_type === "club") {
            const err: any = new Error("Club accounts cannot use student college phone verification.");
            err.statusCode = 403;
            throw err;
        }

        const canonical = norm.canonical;

        // Rate limiting via Redis
        if (!deps?.skipRateLimit && redis && redis.status === "ready") {
            const cooldownKey = `college_phone_cooldown:${userId}`;
            const ttl = await redis.ttl(cooldownKey);
            if (ttl > 0) {
                const err: any = new Error(`Please wait ${ttl} seconds before requesting another SMS code.`);
                err.statusCode = 429;
                err.cooldownRemainingSeconds = ttl;
                throw err;
            }

            const hourlyKey = `college_phone_hourly:${userId}`;
            const count = await redis.incr(hourlyKey);
            if (count === 1) await redis.expire(hourlyKey, 3600);
            if (count > 5) {
                const err: any = new Error("Hourly SMS verification limit reached (5/hr). Please try again later.");
                err.statusCode = 429;
                throw err;
            }
            await redis.set(cooldownKey, "1", "EX", 60);
        }

        const rawOtp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Invalidate prior pending OTPs for this user
        await activeQuery(
            `UPDATE college_verification_phone_otps 
             SET status = 'expired' 
             WHERE user_id = $1 AND status = 'pending';`,
            [userId]
        );

        let activeVerificationId: string | null = null;
        try {
            const vRes = await activeQuery(
                `SELECT id FROM college_verifications WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING') LIMIT 1;`,
                [userId]
            );
            if (vRes.rows[0]) {
                activeVerificationId = vRes.rows[0].id;
            }
        } catch {}

        const insertOtpRes = await activeQuery(
            `INSERT INTO college_verification_phone_otps (
                user_id, verification_id, phone, otp_hash, status, attempts, expires_at
             ) VALUES ($1, $2, $3, $4, 'pending', 0, $5)
             RETURNING id;`,
            [userId, activeVerificationId, canonical, otpHash, expiresAt]
        );
        const insertedOtpId = insertOtpRes?.rows?.[0]?.id;

        const activeSmsSender = deps?.smsSender || sendVerificationSms;
        const isProduction = process.env.NODE_ENV === "production";
        let smsResult: any = null;
        let smsDispatchError: any = null;

        try {
            smsResult = await activeSmsSender({
                to: canonical,
                otp: rawOtp,
                clubName: "Orbix College Verification",
            });
        } catch (smsErr: any) {
            smsDispatchError = smsErr;
        }

        const simulatedInProduction = isProduction && smsResult?.simulated === true;
        const deliveryFailed =
            Boolean(smsDispatchError) ||
            smsResult?.success === false ||
            simulatedInProduction;

        if (deliveryFailed) {
            if (insertedOtpId) {
                try {
                    await activeQuery(
                        `UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1;`,
                        [insertedOtpId]
                    );
                } catch {}
            }
            if (!deps?.skipRateLimit && redis && redis.status === "ready") {
                try {
                    await redis.del(`college_phone_cooldown:${userId}`);
                } catch {}
            }

            const rawErr = simulatedInProduction
                ? "Simulated SMS delivery is prohibited in production."
                : smsDispatchError?.message || smsResult?.error || "Failed to send SMS verification code.";
            const redactedErr = String(rawErr).split(rawOtp).join("[REDACTED]");
            console.error("[CollegeVerification] SMS delivery failed (OTP redacted):", redactedErr);

            const err: any = new Error(
                "Unable to send SMS verification code right now. Please try again later."
            );
            err.statusCode = isProduction && (!smsResult?.providerError || simulatedInProduction) ? 503 : 502;
            throw err;
        }

        return {
            success: true,
            message: `Verification code sent to ${norm.formatted}.`,
            phone: norm.formatted,
            canonical,
            cooldownSeconds: 60,
        };
    }

    /**
     * Authoritatively verifies the 6-digit phone OTP.
     */
    public static async verifyPhoneOtp(params: {
        userId: string;
        phone: string;
        otp: string;
    }, deps?: VerificationChannelDeps) {
        const { userId, phone, otp } = params;
        const activeQuery = deps?.query || query;
        const norm = normalizePhoneNumber(phone);

        if (!norm.isValid) {
            const err: any = new Error("Invalid phone format.");
            err.statusCode = 400;
            throw err;
        }

        if (!otp || otp.trim().length !== 6) {
            const err: any = new Error("Please enter a valid 6-digit verification code.");
            err.statusCode = 400;
            throw err;
        }

        const canonical = norm.canonical;
        const tokenRes = await activeQuery(
            `SELECT id, otp_hash, attempts, expires_at 
             FROM college_verification_phone_otps 
             WHERE user_id = $1 AND phone = $2 AND status = 'pending' 
             ORDER BY created_at DESC LIMIT 1;`,
            [userId, canonical]
        );

        const row = tokenRes.rows[0];
        if (!row) {
            const err: any = new Error("No pending verification code found for this phone number. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        if (row.attempts >= 5) {
            await activeQuery(`UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1;`, [row.id]);
            const err: any = new Error("Too many incorrect attempts. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        if (new Date(row.expires_at).getTime() < Date.now()) {
            await activeQuery(`UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1;`, [row.id]);
            const err: any = new Error("Verification code has expired. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        const submittedHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
        if (submittedHash !== row.otp_hash) {
            await activeQuery(`UPDATE college_verification_phone_otps SET attempts = attempts + 1 WHERE id = $1;`, [row.id]);
            const remaining = 4 - row.attempts;
            const err: any = new Error(`Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : ""}`);
            err.statusCode = 400;
            throw err;
        }

        const verifiedAt = new Date();

        // Atomically mark OTP verified to prevent concurrent race conditions
        const updateOtpRes = await activeQuery(
            `UPDATE college_verification_phone_otps 
             SET status = 'verified', verified_at = $1 
             WHERE id = $2 AND status = 'pending'
             RETURNING id;`,
            [verifiedAt, row.id]
        );

        if (!updateOtpRes.rows[0]) {
            const err: any = new Error("Verification code has already been used or expired.");
            err.statusCode = 400;
            throw err;
        }

        // Update active verification record with verified phone number
        await activeQuery(
            `UPDATE college_verifications 
             SET phone_number = $1, phone_verified_at = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = $3 AND status IN ('PENDING', 'PROCESSING');`,
            [canonical, verifiedAt, userId]
        );

        return {
            success: true,
            message: "Phone number verified successfully!",
            phone: norm.formatted,
            canonical,
            verifiedAt: verifiedAt.toISOString(),
        };
    }

    /**
     * Founder Review Operations: Lists applications queue with search and status filtering.
     */
    public static async listQueue(filters: {
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }) {
        const { status = "all", search = "", limit = 25, offset = 0 } = filters;

        const whereClauses: string[] = [];
        const params: any[] = [];
        let pIndex = 1;

        if (status && status !== "all") {
            whereClauses.push(`cv.status = $${pIndex++}`);
            params.push(status.toUpperCase());
        }

        if (search && search.trim().length > 0) {
            const cleanSearch = `%${search.trim().toLowerCase()}%`;
            whereClauses.push(`(
                LOWER(u.username) LIKE $${pIndex} OR 
                LOWER(COALESCE(cv.student_name, '')) LIKE $${pIndex} OR 
                LOWER(COALESCE(cv.enrollment_number, '')) LIKE $${pIndex} OR 
                LOWER(COALESCE(i.official_name, '')) LIKE $${pIndex} OR 
                LOWER(COALESCE(cv.institution_email, '')) LIKE $${pIndex}
            )`);
            params.push(cleanSearch);
            pIndex++;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        // Count query
        const countRes = await query(
            `SELECT COUNT(*)::int AS total 
             FROM college_verifications cv 
             LEFT JOIN users u ON cv.user_id = u.id 
             LEFT JOIN institutions i ON cv.college_id = i.id 
             ${whereSql};`,
            params
        );
        const total = countRes.rows[0]?.total || 0;

        // Data query
        params.push(Math.min(100, Math.max(1, limit)));
        params.push(Math.max(0, offset));

        const dataRes = await query(
            `SELECT cv.*,
                    u.username, u.email AS "userEmail", u.firstname AS "userFirstName", u.lastname AS "userLastName",
                    u.avatar_url AS "userAvatarUrl", u.created_at AS "userCreatedAt",
                    i.official_name AS "collegeName", i.city AS "collegeCity", i.state AS "collegeState", i.aishe_code AS "aisheCode", i.website AS "collegeWebsite",
                    reviewer.username AS "reviewerUsername"
             FROM college_verifications cv
             LEFT JOIN users u ON cv.user_id = u.id
             LEFT JOIN institutions i ON cv.college_id = i.id
             LEFT JOIN users reviewer ON cv.reviewed_by = reviewer.id
             ${whereSql}
             ORDER BY cv.created_at DESC
             LIMIT $${pIndex++} OFFSET $${pIndex++};`,
            params
        );

        const applications = dataRes.rows.map((row) => this.formatApplicationRow(row, true));

        return {
            success: true,
            total,
            limit,
            offset,
            applications,
        };
    }

    /**
     * Founder Review: Retrieves full application details with signed preview URLs.
     */
    public static async getApplication(id: string) {
        const res = await query(
            `SELECT cv.*,
                    u.username, u.email AS "userEmail", u.firstname AS "userFirstName", u.lastname AS "userLastName",
                    u.avatar_url AS "userAvatarUrl", u.college_id AS "currentCollegeId", u.created_at AS "userCreatedAt",
                    i.official_name AS "collegeName", i.city AS "collegeCity", i.state AS "collegeState", i.aishe_code AS "aisheCode", i.website AS "collegeWebsite",
                    reviewer.username AS "reviewerUsername"
             FROM college_verifications cv
             LEFT JOIN users u ON cv.user_id = u.id
             LEFT JOIN institutions i ON cv.college_id = i.id
             LEFT JOIN users reviewer ON cv.reviewed_by = reviewer.id
             WHERE cv.id = $1 LIMIT 1;`,
            [id]
        );

        const row = res.rows[0];
        if (!row) {
            const err: any = new Error("College verification application not found.");
            err.statusCode = 404;
            throw err;
        }

        return {
            success: true,
            application: this.formatApplicationRow(row, true),
        };
    }

    /**
     * Founder Review: Concurrency-Safe Atomic Approval of a college verification application.
     * Enforces conditional status transitions in PostgreSQL:
     * - Allows approval ONLY from eligible review states ('PENDING', 'PROCESSING').
     * - Serializes concurrent founder reviews via row-level locks on the application record.
     * - Enforces atomic transaction rollback on failure.
     * - Guarantees the winning founder's UUID and review timestamp cannot be overwritten by losing requests.
     * - Restricts post-commit side effects (notifications, cache invalidation, audit hooks) strictly to the winning request.
     */
    public static async approveApplication(
        id: string,
        reviewerId: string,
        notes?: string,
        deps?: ApproveApplicationDeps
    ) {
        if (!id || typeof id !== "string") {
            const err: any = new Error("Application ID is required.");
            err.statusCode = 400;
            throw err;
        }

        const initialQuery = deps?.client
            ? (text: string, params?: any[]) => deps!.client!.query(text, params)
            : (deps?.query || query);

        // 1. Initial lookup to retrieve user details and perform pre-flight eligibility check
        const appRes = await initialQuery(
            `SELECT cv.*, u.college_id AS "userCollegeId", u.username, u.firstname, u.lastname, u.account_type AS "userAccountType"
             FROM college_verifications cv
             JOIN users u ON cv.user_id = u.id
             WHERE cv.id = $1 LIMIT 1;`,
            [id]
        );

        const app = appRes.rows[0];
        if (!app) {
            const err: any = new Error("Application not found");
            err.statusCode = 404;
            throw err;
        }

        // Fast-path eligibility checks
        if (app.status === "APPROVED") {
            const err: any = new Error("This application has already been approved.");
            err.statusCode = 409;
            throw err;
        }
        if (app.status === "REJECTED") {
            const err: any = new Error("This application has been rejected and cannot be approved.");
            err.statusCode = 409;
            throw err;
        }
        if (app.status === "INVALIDATED") {
            const err: any = new Error("This application has been invalidated and cannot be approved.");
            err.statusCode = 409;
            throw err;
        }
        if (app.status !== "PENDING" && app.status !== "PROCESSING") {
            const err: any = new Error(`Application is not in an eligible state for approval (current status: ${app.status}).`);
            err.statusCode = 409;
            throw err;
        }
        if (app.userAccountType === "club") {
            const err: any = new Error("Club accounts cannot be approved through student college verification.");
            err.statusCode = 403;
            throw err;
        }
        if (!app.email_verified_at && !app.phone_verified_at) {
            const err: any = new Error(
                "Cannot approve application: both institutional email verification and mobile phone OTP verification are required."
            );
            err.statusCode = 400;
            throw err;
        }
        if (!app.email_verified_at) {
            const err: any = new Error(
                "Cannot approve application: institutional email verification is missing or unverified."
            );
            err.statusCode = 400;
            throw err;
        }
        if (!app.phone_verified_at) {
            const err: any = new Error(
                "Cannot approve application: mobile phone OTP verification is missing or unverified."
            );
            err.statusCode = 400;
            throw err;
        }

        // 2. Acquire transactional client
        const isExternalClient = Boolean(deps?.client);
        let client: { query: (text: string, params?: any[]) => Promise<any>; release?: () => void };

        if (deps?.client) {
            client = deps.client;
        } else if (deps?.pool) {
            client = await deps.pool.connect();
        } else {
            client = await pool.connect();
        }

        let approvedRow: any = null;
        const now = new Date();

        try {
            await client.query("BEGIN;");

            // 3. ATOMIC CONDITIONAL UPDATE:
            // PostgreSQL serializes concurrent updates to the same row.
            // Enforces both review-state eligibility AND mandatory verified email & phone timestamps atomically.
            const updateRes = await client.query(
                `UPDATE college_verifications
                 SET status = 'APPROVED',
                     reviewed_by = $1,
                     reviewed_at = $2,
                     reviewer_notes = $3,
                     updated_at = $2
                 WHERE id = $4
                   AND status IN ('PENDING', 'PROCESSING')
                   AND email_verified_at IS NOT NULL
                   AND phone_verified_at IS NOT NULL
                 RETURNING *;`,
                [reviewerId, now, notes || "Approved by founder", id]
            );

            // 4. LOSING REQUEST / PRECONDITION FAILURE HANDLING:
            // If zero rows updated, inspect current database state to distinguish race conflicts from unmet verification factors.
            if (!updateRes.rows || updateRes.rows.length === 0) {
                await client.query("ROLLBACK;");

                // Safely inspect current database state to deliver accurate diagnostics
                const currentRes = await client.query(
                    `SELECT status, reviewed_by, reviewed_at, email_verified_at, phone_verified_at FROM college_verifications WHERE id = $1 LIMIT 1;`,
                    [id]
                );
                const current = currentRes.rows[0];
                const currentStatus = current?.status;

                if (currentStatus === "PENDING" || currentStatus === "PROCESSING") {
                    if (!current?.email_verified_at && !current?.phone_verified_at) {
                        const err: any = new Error(
                            "Cannot approve application: both institutional email verification and mobile phone OTP verification are required."
                        );
                        err.statusCode = 400;
                        throw err;
                    }
                    if (!current?.email_verified_at) {
                        const err: any = new Error(
                            "Cannot approve application: institutional email verification is missing or unverified."
                        );
                        err.statusCode = 400;
                        throw err;
                    }
                    if (!current?.phone_verified_at) {
                        const err: any = new Error(
                            "Cannot approve application: mobile phone OTP verification is missing or unverified."
                        );
                        err.statusCode = 400;
                        throw err;
                    }
                }

                let conflictMessage = "This application has already been approved.";
                if (currentStatus === "APPROVED") {
                    conflictMessage = "This application has already been approved.";
                } else if (currentStatus === "REJECTED") {
                    conflictMessage = "This application has been rejected and cannot be approved.";
                } else if (currentStatus === "INVALIDATED") {
                    conflictMessage = "This application has been invalidated and cannot be approved.";
                } else if (currentStatus) {
                    conflictMessage = `Application is not in an eligible state for approval (current status: ${currentStatus}).`;
                }

                const conflictErr: any = new Error(conflictMessage);
                conflictErr.statusCode = 409;
                conflictErr.conflictDetails = {
                    currentStatus,
                    reviewedBy: current?.reviewed_by,
                    reviewedAt: current?.reviewed_at,
                };
                throw conflictErr;
            }

            approvedRow = updateRes.rows[0];

            // 5. Invalidate any prior APPROVED verifications for this user
            // (Maintains Invariant 2: exactly one approved verification per user)
            await client.query(
                `UPDATE college_verifications
                 SET status = 'INVALIDATED', updated_at = $1
                 WHERE user_id = $2 AND status = 'APPROVED' AND id != $3;`,
                [now, app.user_id, id]
            );

            // 6. Update users table cache columns atomically within the same transaction
            await client.query(
                `UPDATE users
                 SET is_college_verified = true, college_verified_at = $1
                 WHERE id = $2;`,
                [now, app.user_id]
            );

            await client.query("COMMIT;");
        } catch (txErr: any) {
            try {
                await client.query("ROLLBACK;");
            } catch {}
            throw txErr;
        } finally {
            if (!isExternalClient && client && typeof client.release === "function") {
                client.release();
            }
        }

        // 7. POST-COMMIT SIDE EFFECTS (Executed strictly for the WINNING request):
        // Since transaction has committed, side-effect failures must NOT claim approval failed.
        try {
            const deleteCache = deps?.cache?.deleteUserDetailsCache || deleteUserDetailsCache;
            const invalidateAll = deps?.cache?.invalidateAllUserCaches || invalidateAllUserCaches;

            await deleteCache(app.user_id);
            const userLookup = await (deps?.query || query)(`SELECT username FROM users WHERE id = $1;`, [app.user_id]);
            const username = userLookup.rows[0]?.username;
            if (username) {
                await invalidateAll({ username, id: app.user_id });
            }

            // In-app user notification
            try {
                if (username) {
                    await (deps?.query || query)(
                        `INSERT INTO user_notifications (
                            user_id, username, title, body, type, metadata
                         ) VALUES ($1, $2, $3, $4, 'system', $5);`,
                        [
                            app.user_id,
                            username,
                            "College Verification Approved!",
                            "Your college verification application has been approved. Your verified badge is now active!",
                            JSON.stringify({ verificationId: id, collegeId: app.college_id }),
                        ]
                    );
                }
            } catch (notifErr: any) {
                console.warn("[CollegeVerification] Non-fatal notification delivery error:", notifErr?.message || notifErr);
            }

            // External audit hook (if configured)
            if (deps?.auditHook) {
                await deps.auditHook({
                    action: "COLLEGE_VERIFICATION_APPROVED",
                    applicationId: id,
                    userId: app.user_id,
                    reviewerId,
                    status: "APPROVED",
                    timestamp: now,
                });
            }

            // External notification hook (if configured)
            if (deps?.notificationHook) {
                await deps.notificationHook(approvedRow);
            }
        } catch (sideEffectErr: any) {
            console.error("[CollegeVerification] Non-fatal post-commit side-effect error:", sideEffectErr?.message || sideEffectErr);
        }

        return {
            success: true,
            message: "College verification application approved successfully.",
            application: this.formatApplicationRow(approvedRow, false),
        };
    }

    /**
     * Founder Review: Concurrency-Safe Rejection of a college verification application with mandatory reason.
     */
    public static async rejectApplication(
        id: string,
        reviewerId: string,
        reason: string,
        notes?: string,
        deps?: { query?: (text: string, params?: any[]) => Promise<any> }
    ) {
        if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
            const err: any = new Error("A clear rejection reason is mandatory to guide the student.");
            err.statusCode = 400;
            throw err;
        }

        const queryFn = deps?.query || query;

        const appRes = await queryFn(`SELECT * FROM college_verifications WHERE id = $1 LIMIT 1;`, [id]);
        const app = appRes.rows[0];
        if (!app) {
            const err: any = new Error("Application not found");
            err.statusCode = 404;
            throw err;
        }

        if (app.status === "APPROVED") {
            const err: any = new Error("An approved application cannot be rejected.");
            err.statusCode = 409;
            throw err;
        }
        if (app.status === "REJECTED") {
            const err: any = new Error("This application has already been rejected.");
            err.statusCode = 409;
            throw err;
        }
        if (app.status !== "PENDING" && app.status !== "PROCESSING") {
            const err: any = new Error(`Application is not in an eligible state for review (current status: ${app.status}).`);
            err.statusCode = 409;
            throw err;
        }

        const now = new Date();

        const updateRes = await queryFn(
            `UPDATE college_verifications 
             SET status = 'REJECTED', rejection_reason = $1, reviewed_by = $2, reviewed_at = $3, reviewer_notes = $4, updated_at = $3 
             WHERE id = $5 
               AND status IN ('PENDING', 'PROCESSING')
             RETURNING *;`,
            [reason.trim(), reviewerId, now, notes || null, id]
        );

        if (!updateRes.rows || updateRes.rows.length === 0) {
            const currentRes = await queryFn(`SELECT status FROM college_verifications WHERE id = $1 LIMIT 1;`, [id]);
            const currentStatus = currentRes.rows[0]?.status;
            const err: any = new Error(
                currentStatus === "APPROVED"
                    ? "An approved application cannot be rejected."
                    : currentStatus === "REJECTED"
                    ? "This application has already been rejected."
                    : `Application is not in an eligible state for review (current status: ${currentStatus || "unknown"}).`
            );
            err.statusCode = 409;
            throw err;
        }

        // If user has no other approved verification, update users table
        await queryFn(
            `UPDATE users 
             SET is_college_verified = false 
             WHERE id = $1 AND NOT EXISTS (
                 SELECT 1 FROM college_verifications WHERE user_id = $1 AND status = 'APPROVED'
             );`,
            [app.user_id]
        );

        try {
            await deleteUserDetailsCache(app.user_id);
            const user = await queryFn(`SELECT username FROM users WHERE id = $1;`, [app.user_id]);
            if (user.rows[0]?.username) {
                await invalidateAllUserCaches({ username: user.rows[0].username, id: app.user_id });
            }
        } catch {}

        return {
            success: true,
            message: "College verification application rejected.",
            application: this.formatApplicationRow(updateRes.rows[0], false),
        };
    }

    /**
     * College Change Integration: Invalidate previous verification when a student modifies their college affiliation.
     */
    public static async invalidateForCollegeChange(userId: string, newCollegeId: string | null) {
        const now = new Date();

        // Invalidate any approved or pending verifications
        await query(
            `UPDATE college_verifications 
             SET status = 'INVALIDATED', updated_at = $1 
             WHERE user_id = $2 AND status IN ('APPROVED', 'PENDING', 'PROCESSING');`,
            [now, userId]
        );

        await query(
            `UPDATE users 
             SET is_college_verified = false, college_verified_at = NULL 
             WHERE id = $1;`,
            [userId]
        );

        try {
            await deleteUserDetailsCache(userId);
            const user = await query(`SELECT username FROM users WHERE id = $1;`, [userId]);
            if (user.rows[0]?.username) {
                await invalidateAllUserCaches({ username: user.rows[0].username, id: userId });
            }
        } catch {}
    }

    /**
     * Saves document buffer to Cloudinary (authenticated private mode) or local secure folder.
     */
    private static async savePrivateDocument(
        buffer: Buffer,
        originalName: string,
        format: "jpg" | "png" | "webp",
        uploaderOverride?: any,
        isConfiguredOverride?: () => boolean
    ): Promise<StoredDocument> {
        const isProduction = process.env.NODE_ENV === "production";
        const checkConfigured = isConfiguredOverride || isCloudinaryConfigured;
        const activeUploader = uploaderOverride || cloudinary.uploader;

        if (checkConfigured()) {
            try {
                return await new Promise<StoredDocument>((resolve, reject) => {
                    const stream = activeUploader.upload_stream(
                        {
                            folder: process.env.CLOUDINARY_VERIFICATION_FOLDER || DEFAULT_VERIFICATION_FOLDER,
                            resource_type: "image",
                            type: "authenticated",
                            format,
                        },
                        (error: any, result: any) => {
                            if (error || !result) {
                                return reject(new Error(`Cloudinary upload failed: ${error?.message || "Unknown error"}`));
                            }
                            resolve({
                                storage: "cloudinary",
                                publicId: result.public_id,
                                originalName,
                                mimeType: `image/${format}`,
                                size: result.bytes || buffer.length,
                                format: result.format || format,
                                uploadedAt: new Date().toISOString(),
                            });
                        }
                    );
                    stream.end(buffer);
                });
            } catch (cloudErr: any) {
                if (isProduction || uploaderOverride) {
                    throw new Error(`Production document storage failed: ${cloudErr.message}. Upload aborted to safeguard student privacy.`);
                }
                console.warn("[CollegeVerification] Cloudinary upload notice (falling back to secure local storage):", cloudErr.message);
            }
        } else if (isProduction) {
            throw new Error(
                "Secure authenticated Cloudinary storage is mandatory in production. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
            );
        }

        // Development/Test fallback: Secure local storage
        const safeName = `${crypto.randomUUID()}.${format}`;
        const filePath = path.join(LOCAL_UPLOAD_DIR, safeName);
        fs.writeFileSync(filePath, buffer);

        return {
            storage: "local",
            filename: safeName,
            originalName,
            mimeType: `image/${format}`,
            size: buffer.length,
            format,
            uploadedAt: new Date().toISOString(),
        };
    }

    /**
     * Safely deletes a document uploaded during a failed submission attempt.
     * Restricts deletion to assets explicitly created during this submission.
     */
    public static async deleteUploadedDocument(
        doc: StoredDocument,
        uploaderOverride?: { destroy: (publicId: string, options: any) => Promise<any> }
    ): Promise<boolean> {
        if (!doc) return false;

        if (doc.storage === "cloudinary" && doc.publicId) {
            const activeUploader = uploaderOverride || cloudinary.uploader;

            try {
                // College verification documents are uploaded with type: "authenticated"
                let result = await activeUploader.destroy(doc.publicId, {
                    resource_type: "image",
                    type: "authenticated",
                    invalidate: true,
                });

                if (result?.result !== "ok" && result?.result !== "not found") {
                    result = await activeUploader.destroy(doc.publicId, {
                        resource_type: "image",
                        invalidate: true,
                    });
                }

                const isSuccess = result?.result === "ok" || result?.result === "not found";
                if (!isSuccess) {
                    console.error("[CollegeVerification Cleanup] Cloudinary deletion API returned failure:", {
                        publicId: doc.publicId,
                        result: result?.result,
                        error: result?.error?.message || result?.error || "Unknown error",
                    });
                }
                return isSuccess;
            } catch (err: any) {
                console.error("[CollegeVerification Cleanup] Cloudinary deletion threw exception:", {
                    publicId: doc.publicId,
                    error: err?.message || String(err),
                });
                return false;
            }
        }

        if (doc.storage === "local" && doc.filename) {
            try {
                const safeName = path.basename(doc.filename);
                const filePath = path.join(LOCAL_UPLOAD_DIR, safeName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                return true;
            } catch (err: any) {
                console.error("[CollegeVerification Cleanup] Local file deletion error:", {
                    filename: doc.filename,
                    error: err?.message || String(err),
                });
                return false;
            }
        }

        return false;
    }

    /**
     * Cleans up all newly uploaded documents if a submission attempt fails.
     * Ensures failure of one deletion does not stop remaining deletions.
     */
    public static async cleanupUploadedDocuments(
        docs: StoredDocument[],
        uploaderOverride?: { destroy: (publicId: string, options: any) => Promise<any> }
    ): Promise<{ cleaned: string[]; failed: string[] }> {
        const cleaned: string[] = [];
        const failed: string[] = [];

        for (const doc of docs) {
            const identifier = doc.publicId || doc.filename || "unknown";
            try {
                const success = await this.deleteUploadedDocument(doc, uploaderOverride);
                if (success) {
                    cleaned.push(identifier);
                } else {
                    failed.push(identifier);
                }
            } catch (err: any) {
                failed.push(identifier);
                console.error("[CollegeVerification Cleanup] Unhandled exception during asset cleanup:", {
                    identifier,
                    error: err?.message || String(err),
                });
            }
        }

        return { cleaned, failed };
    }

    /**
     * Generates a short-lived signed URL (300 seconds TTL) for founder document preview.
     */
    public static generateSignedDocumentUrl(doc: StoredDocument): string {
        const expiresInSeconds = 300; // 5 minutes

        if (doc.storage === "cloudinary" && doc.publicId) {
            try {
                return cloudinary.utils.private_download_url(doc.publicId, doc.format || "jpg", {
                    resource_type: "image",
                    type: "authenticated",
                    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
                });
            } catch (err: any) {
                console.error("Cloudinary signed URL error:", err);
            }
        }

        // Local storage signed token proxy — requires strong configured signing secret in production
        const signingSecret = getDocumentProxySigningSecret();
        if (!doc.filename || typeof doc.filename !== "string") {
            throw new Error("Local document filename missing for proxy URL signing.");
        }
        const payload = JSON.stringify({
            f: doc.filename,
            exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        });
        const hmac = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");
        const token = Buffer.from(`${payload}::${hmac}`).toString("base64url");

        return `/api/internal/college-verifications/document-proxy/${token}`;
    }

    /**
     * Resolves local file path from signed proxy token.
     */
    public static resolveDocumentFromProxyToken(
        token: string,
        uploadDirOverride?: string
    ): { filePath: string; mimeType: string } | null {
        const signingSecret = getDocumentProxySigningSecret();

        try {
            const raw = Buffer.from(token, "base64url").toString("utf8");
            const sepIndex = raw.lastIndexOf("::");
            if (sepIndex <= 0) return null;

            const payloadStr = raw.slice(0, sepIndex);
            const hmac = raw.slice(sepIndex + 2);
            if (!payloadStr || !hmac) return null;

            const expectedHmac = crypto.createHmac("sha256", signingSecret).update(payloadStr).digest("hex");
            const hmacBuf = Buffer.from(hmac, "hex");
            const expectedBuf = Buffer.from(expectedHmac, "hex");
            if (
                hmacBuf.length !== 32 ||
                hmacBuf.length !== expectedBuf.length ||
                !crypto.timingSafeEqual(hmacBuf, expectedBuf)
            ) {
                return null;
            }

            const payload = JSON.parse(payloadStr);
            if (
                !payload ||
                typeof payload.f !== "string" ||
                !payload.f.trim() ||
                typeof payload.exp !== "number" ||
                payload.exp < Math.floor(Date.now() / 1000)
            ) {
                return null;
            }

            const filename = path.basename(payload.f); // prevent path traversal
            if (!filename || filename === "." || filename === "..") return null;

            const baseDir = uploadDirOverride || LOCAL_UPLOAD_DIR;
            const filePath = path.join(baseDir, filename);
            if (!fs.existsSync(filePath)) return null;

            const ext = path.extname(filename).toLowerCase().replace(".", "");
            const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

            return { filePath, mimeType };
        } catch {
            return null;
        }
    }

    /**
     * Standardizes application row formatting with secure preview URLs.
     */
    private static formatApplicationRow(row: any, includePrivateUrls: boolean) {
        let docs: StoredDocument[] = [];
        try {
            docs = typeof row.document_paths === "string" ? JSON.parse(row.document_paths) : row.document_paths || [];
        } catch {
            docs = [];
        }

        const previewUrls = includePrivateUrls
            ? docs.map((d) => ({
                  url: this.generateSignedDocumentUrl(d),
                  originalName: d.originalName,
                  size: d.size,
                  format: d.format,
              }))
            : [];

        return {
            id: row.id,
            user_id: row.user_id,
            college_id: row.college_id,
            status: row.status,
            document_type: row.document_type,
            student_name: row.student_name,
            enrollment_number: row.enrollment_number,
            course_name: row.course_name,
            academic_year: row.academic_year,
            institution_email: row.institution_email,
            is_email_verified: Boolean(row.email_verified_at),
            email_verified_at: row.email_verified_at,
            phone_number: row.phone_number,
            is_phone_verified: Boolean(row.phone_verified_at),
            phone_verified_at: row.phone_verified_at,
            ocr_confidence: Number(row.ocr_confidence || 0),
            extracted_data: typeof row.extracted_data === "string" ? JSON.parse(row.extracted_data) : row.extracted_data || {},
            rejection_reason: row.rejection_reason,
            reviewer_notes: row.reviewer_notes,
            reviewed_by: row.reviewed_by,
            reviewer_username: row.reviewerUsername || null,
            reviewed_at: row.reviewed_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
            college_name: row.collegeName || null,
            college_city: row.collegeCity || null,
            college_state: row.collegeState || null,
            college_website: row.collegeWebsite || null,
            // User details if joined
            user_username: row.username || null,
            user_email: row.userEmail || null,
            user_display_name: [row.userFirstName, row.userLastName].filter(Boolean).join(" ") || row.username || null,
            user_avatar_url: row.userAvatarUrl || null,
            user_created_at: row.userCreatedAt || null,
            document_previews: previewUrls,
        };
    }
}
