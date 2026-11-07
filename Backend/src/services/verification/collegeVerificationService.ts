import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { sendVerificationEmail, sendCollegeVerificationEmail } from "../email/resendService.js";
import { sendVerificationSms, normalizePhoneNumber } from "../sms/smsGatewayService.js";
import { cloudinary, isCloudinaryConfigured } from "../../config/cloudinary.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";
import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";
import { CollegeOcrService, type OcrExtractedData } from "./collegeOcrService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "orbix_secret_fallback_key_2026";

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

export class CollegeVerificationService {
    /**
     * Retrieves current verification state, active submission, and submission history for a student.
     */
    public static async getStatus(userId: string) {
        // 1. Fetch user's currently linked college
        const userRes = await query(
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
        const appsRes = await query(
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

        const allApplications = appsRes.rows.map((row) => this.formatApplicationRow(row, false));

        // 3. Determine authoritative state
        // A user is APPROVED if and only if there is an APPROVED record matching their CURRENT college
        const approvedRecord = allApplications.find(
            (a) => a.status === "APPROVED" && currentCollege && a.college_id === currentCollege.id
        );

        let logicalStatus: "NOT_VERIFIED" | "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" = "NOT_VERIFIED";
        let activeApplication: any = null;
        let latestApplication: any = allApplications[0] || null;

        if (approvedRecord) {
            logicalStatus = "APPROVED";
            activeApplication = approvedRecord;
        } else {
            // Check for pending/processing active submission
            const pendingRecord = allApplications.find(
                (a) => a.status === "PENDING" || a.status === "PROCESSING"
            );
            if (pendingRecord) {
                logicalStatus = pendingRecord.status as "PENDING" | "PROCESSING";
                activeApplication = pendingRecord;
            } else if (latestApplication && latestApplication.status === "REJECTED") {
                logicalStatus = "REJECTED";
            } else {
                logicalStatus = "NOT_VERIFIED";
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
    }) {
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

        // 2. Validate user and college alignment
        const userRes = await query(`SELECT id, college_id FROM users WHERE id = $1 LIMIT 1;`, [userId]);
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found");
            err.statusCode = 404;
            throw err;
        }

        if (!user.college_id || user.college_id !== collegeId) {
            const err: any = new Error(
                "The selected institution does not match your currently saved profile college. Please update and save your college in Profile first."
            );
            err.statusCode = 400;
            throw err;
        }

        // 3. Verify institution exists
        const instRes = await query(`SELECT id, official_name, website FROM institutions WHERE id = $1 LIMIT 1;`, [collegeId]);
        if (!instRes.rows[0]) {
            const err: any = new Error("Selected institution was not found in directory.");
            err.statusCode = 404;
            throw err;
        }

        // 4. Duplicate active submission check
        const activeRes = await query(
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

        // 5. Secure document upload
        const storedDocs: StoredDocument[] = [];
        for (const file of files) {
            const val = CollegeOcrService.validateImageBuffer(file.buffer);
            if (!val.isValid) {
                const err: any = new Error(val.error || "Invalid file format");
                err.statusCode = 400;
                throw err;
            }

            const doc = await this.savePrivateDocument(file.buffer, file.originalname, val.format || "jpg");
            storedDocs.push(doc);
        }

        // 6. Check if email was already verified via token
        let emailVerifiedAt: Date | null = null;
        if (institutionEmail) {
            const tokenRes = await query(
                `SELECT verified_at FROM college_verification_email_tokens 
                 WHERE user_id = $1 AND LOWER(institution_email) = LOWER($2) AND status = 'verified' 
                 ORDER BY verified_at DESC LIMIT 1;`,
                [userId, institutionEmail.trim()]
            );
            if (tokenRes.rows[0]?.verified_at) {
                emailVerifiedAt = tokenRes.rows[0].verified_at;
            }
        }

        // 7. Check if phone was already verified via OTP
        let phoneVerifiedAt: Date | null = null;
        if (phoneNumber) {
            const norm = normalizePhoneNumber(phoneNumber);
            if (norm.isValid) {
                const phoneRes = await query(
                    `SELECT verified_at FROM college_verification_phone_otps 
                     WHERE user_id = $1 AND phone = $2 AND status = 'verified' 
                     ORDER BY verified_at DESC LIMIT 1;`,
                    [userId, norm.canonical]
                );
                if (phoneRes.rows[0]?.verified_at) {
                    phoneVerifiedAt = phoneRes.rows[0].verified_at;
                }
            }
        }

        // 8. Insert into college_verifications
        const insertRes = await query(
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
                institutionEmail || extractedData?.institutionEmail || null,
                emailVerifiedAt,
                phoneNumber || extractedData?.phoneNumber || null,
                phoneVerifiedAt,
                ocrConfidence,
            ]
        );

        const created = insertRes.rows[0];
        return {
            success: true,
            message: "College verification application submitted successfully. Orbix founders will review your submission.",
            application: this.formatApplicationRow(created, false),
        };
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
    }) {
        const { userId, email, collegeId, ipAddress = "unknown", userAgent = "unknown" } = params;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            const err: any = new Error("Please provide a valid institutional email address.");
            err.statusCode = 400;
            throw err;
        }

        // 2. Fetch institution and check domain association where available
        const instRes = await query(`SELECT id, official_name, website FROM institutions WHERE id = $1 LIMIT 1;`, [collegeId]);
        const inst = instRes.rows[0];
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

        // 3. Rate limiting via Redis
        if (redis && redis.status === "ready") {
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

        // 4. Generate secure token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Invalidate prior pending tokens for this user & email
        await query(
            `UPDATE college_verification_email_tokens 
             SET status = 'expired' 
             WHERE user_id = $1 AND LOWER(institution_email) = $2 AND status = 'pending';`,
            [userId, normalizedEmail]
        );

        let activeVerificationId: string | null = null;
        try {
            const vRes = await query(
                `SELECT id FROM college_verifications WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING') LIMIT 1;`,
                [userId]
            );
            if (vRes.rows[0]) {
                activeVerificationId = vRes.rows[0].id;
            }
        } catch {}

        await query(
            `INSERT INTO college_verification_email_tokens (
                user_id, verification_id, institution_email, token_hash, status, expires_at
             ) VALUES ($1, $2, $3, $4, 'pending', $5);`,
            [userId, activeVerificationId, normalizedEmail, tokenHash, expiresAt]
        );

        // 5. Send Institutional Verification Email via Resend / SMTP
        const frontendBase = getCanonicalFrontendUrl();
        const verificationLink = `${frontendBase}/profile?verify_college_email=${rawToken}`;
        const collegeName = inst?.official_name || "your institution";

        let studentDisplayName = "Student";
        try {
            const uRow = await query(`SELECT firstname, lastname, username FROM users WHERE id = $1 LIMIT 1;`, [userId]);
            if (uRow.rows[0]) {
                const full = [uRow.rows[0].firstname, uRow.rows[0].lastname].filter(Boolean).join(" ");
                studentDisplayName = full || uRow.rows[0].username || "Student";
            }
        } catch {}

        try {
            await sendCollegeVerificationEmail({
                to: normalizedEmail,
                studentName: studentDisplayName,
                collegeName,
                verificationLink,
                expiresInHours: 24,
            });
        } catch (emailErr: any) {
            console.warn("[CollegeVerification] Send email notice (simulated delivery if unconfigured):", emailErr.message);
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
    public static async verifyInstitutionalEmailToken(token: string, userId?: string, verificationId?: string) {
        if (!token || typeof token !== "string") {
            const err: any = new Error("Verification token is required.");
            err.statusCode = 400;
            throw err;
        }

        const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

        const tokenRes = await query(
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

        if (row.status === "verified") {
            const err: any = new Error("Verification token has already been used.");
            err.statusCode = 400;
            throw err;
        }

        if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
            if (row.status !== "expired") {
                await query(`UPDATE college_verification_email_tokens SET status = 'expired' WHERE id = $1;`, [row.id]);
            }
            const err: any = new Error("Verification token has expired. Please request a new verification email.");
            err.statusCode = 400;
            throw err;
        }

        // Validate user binding if userId is provided
        if (userId && row.user_id !== userId) {
            const err: any = new Error("This verification token belongs to a different user account.");
            err.statusCode = 403;
            throw err;
        }

        // Validate verification application binding if verificationId is provided and token is bound
        if (verificationId && row.verification_id && row.verification_id !== verificationId) {
            const err: any = new Error("This verification token belongs to a different verification application.");
            err.statusCode = 403;
            throw err;
        }

        const verifiedAt = new Date();

        // Mark token verified
        await query(
            `UPDATE college_verification_email_tokens 
             SET status = 'verified', verified_at = $1 
             WHERE id = $2;`,
            [verifiedAt, row.id]
        );

        // If user has an active or pending verification, update its institutional email state
        await query(
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
    }) {
        const { userId, phone, ipAddress = "unknown", userAgent = "unknown" } = params;
        const norm = normalizePhoneNumber(phone);

        if (!norm.isValid) {
            const err: any = new Error("Please enter a valid 10-digit mobile phone number.");
            err.statusCode = 400;
            throw err;
        }

        const canonical = norm.canonical;

        // Rate limiting via Redis
        if (redis && redis.status === "ready") {
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
        await query(
            `UPDATE college_verification_phone_otps 
             SET status = 'expired' 
             WHERE user_id = $1 AND status = 'pending';`,
            [userId]
        );

        await query(
            `INSERT INTO college_verification_phone_otps (
                user_id, phone, otp_hash, status, attempts, expires_at
             ) VALUES ($1, $2, $3, 'pending', 0, $4);`,
            [userId, canonical, otpHash, expiresAt]
        );

        try {
            await sendVerificationSms({
                to: canonical,
                otp: rawOtp,
                clubName: "Orbix College Verification",
            });
        } catch (smsErr: any) {
            console.warn("[CollegeVerification] SMS delivery warning:", smsErr.message);
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
    }) {
        const { userId, phone, otp } = params;
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
        const tokenRes = await query(
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
            await query(`UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1;`, [row.id]);
            const err: any = new Error("Too many incorrect attempts. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        if (new Date(row.expires_at).getTime() < Date.now()) {
            await query(`UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1;`, [row.id]);
            const err: any = new Error("Verification code has expired. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        const submittedHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
        if (submittedHash !== row.otp_hash) {
            await query(`UPDATE college_verification_phone_otps SET attempts = attempts + 1 WHERE id = $1;`, [row.id]);
            const remaining = 4 - row.attempts;
            const err: any = new Error(`Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : ""}`);
            err.statusCode = 400;
            throw err;
        }

        const verifiedAt = new Date();

        await query(
            `UPDATE college_verification_phone_otps 
             SET status = 'verified', verified_at = $1 
             WHERE id = $2;`,
            [verifiedAt, row.id]
        );

        // Update active verification record with verified phone number
        await query(
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
     * Founder Review: Approves a college verification application.
     */
    public static async approveApplication(id: string, reviewerId: string, notes?: string) {
        // Check application
        const appRes = await query(
            `SELECT cv.*, u.college_id AS "userCollegeId" 
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

        if (app.status === "APPROVED") {
            const err: any = new Error("This application has already been approved.");
            err.statusCode = 400;
            throw err;
        }

        const now = new Date();

        // Transactional approval
        // 1. Invalidate any prior APPROVED verifications for this user
        await query(
            `UPDATE college_verifications 
             SET status = 'INVALIDATED', updated_at = $1 
             WHERE user_id = $2 AND status = 'APPROVED' AND id != $3;`,
            [now, app.user_id, id]
        );

        // 2. Mark this verification APPROVED
        const updateRes = await query(
            `UPDATE college_verifications 
             SET status = 'APPROVED', reviewed_by = $1, reviewed_at = $2, reviewer_notes = $3, updated_at = $2 
             WHERE id = $4 
             RETURNING *;`,
            [reviewerId, now, notes || "Approved by founder", id]
        );

        // 3. Update users table cache column
        await query(
            `UPDATE users 
             SET is_college_verified = true, college_verified_at = $1 
             WHERE id = $2;`,
            [now, app.user_id]
        );

        // 4. Invalidate auth and profile cache
        try {
            await deleteUserDetailsCache(app.user_id);
            const user = await query(`SELECT username FROM users WHERE id = $1;`, [app.user_id]);
            if (user.rows[0]?.username) {
                await invalidateAllUserCaches({ username: user.rows[0].username, id: app.user_id });
            }
        } catch {}

        return {
            success: true,
            message: "College verification application approved successfully.",
            application: this.formatApplicationRow(updateRes.rows[0], false),
        };
    }

    /**
     * Founder Review: Rejects a college verification application with a mandatory rejection reason.
     */
    public static async rejectApplication(id: string, reviewerId: string, reason: string, notes?: string) {
        if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
            const err: any = new Error("A clear rejection reason is mandatory to guide the student.");
            err.statusCode = 400;
            throw err;
        }

        const appRes = await query(`SELECT * FROM college_verifications WHERE id = $1 LIMIT 1;`, [id]);
        const app = appRes.rows[0];
        if (!app) {
            const err: any = new Error("Application not found");
            err.statusCode = 404;
            throw err;
        }

        const now = new Date();

        const updateRes = await query(
            `UPDATE college_verifications 
             SET status = 'REJECTED', rejection_reason = $1, reviewed_by = $2, reviewed_at = $3, reviewer_notes = $4, updated_at = $3 
             WHERE id = $5 
             RETURNING *;`,
            [reason.trim(), reviewerId, now, notes || null, id]
        );

        // If user has no other approved verification, update users table
        await query(
            `UPDATE users 
             SET is_college_verified = false 
             WHERE id = $1 AND NOT EXISTS (
                 SELECT 1 FROM college_verifications WHERE user_id = $1 AND status = 'APPROVED'
             );`,
            [app.user_id]
        );

        try {
            await deleteUserDetailsCache(app.user_id);
            const user = await query(`SELECT username FROM users WHERE id = $1;`, [app.user_id]);
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
        format: "jpg" | "png" | "webp"
    ): Promise<StoredDocument> {
        const isProduction = process.env.NODE_ENV === "production";

        if (isCloudinaryConfigured()) {
            try {
                return await new Promise<StoredDocument>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: "orbix/college_verifications",
                            resource_type: "image",
                            type: "authenticated",
                            format,
                        },
                        (error, result) => {
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
                if (isProduction) {
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

        // Local storage signed token proxy
        const payload = JSON.stringify({
            f: doc.filename,
            exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        });
        const hmac = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
        const token = Buffer.from(`${payload}::${hmac}`).toString("base64url");

        return `/api/internal/college-verifications/document-proxy/${token}`;
    }

    /**
     * Resolves local file path from signed proxy token.
     */
    public static resolveDocumentFromProxyToken(token: string): { filePath: string; mimeType: string } | null {
        try {
            const raw = Buffer.from(token, "base64url").toString("utf8");
            const [payloadStr, hmac] = raw.split("::");
            if (!payloadStr || !hmac) return null;

            const expectedHmac = crypto.createHmac("sha256", JWT_SECRET).update(payloadStr).digest("hex");
            if (hmac !== expectedHmac) return null;

            const payload = JSON.parse(payloadStr);
            if (payload.exp < Math.floor(Date.now() / 1000)) return null;

            const filename = path.basename(payload.f); // prevent path traversal
            const filePath = path.join(LOCAL_UPLOAD_DIR, filename);
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
