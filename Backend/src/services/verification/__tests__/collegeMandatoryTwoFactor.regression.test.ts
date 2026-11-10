/**
 * ORBIX COLLEGE VERIFICATION — STAGE 4.4B REGRESSION SUITE
 * Mandatory Institutional Email + Phone OTP Verification Enforcement
 *
 * 100% Isolated In-Memory Relational Store (Zero live DB/Cloud/SMS/Email network egress).
 * Exercises the ACTUAL CollegeVerificationService methods against realistic tables & transactions.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import redis from "../../../redis/client.js";
import {
    CollegeVerificationService,
    type SubmitApplicationDeps,
    type ApproveApplicationDeps,
    type VerificationChannelDeps,
} from "../collegeVerificationService.js";

interface MockUser {
    id: string;
    college_id: string | null;
    college: string | null;
    college_updated_at: Date | null;
    account_type: "personal" | "club" | "admin";
    firstname: string;
    lastname: string;
    username: string;
    is_college_verified: boolean;
    college_verified_at: Date | null;
}

interface MockInstitution {
    id: string;
    official_name: string;
    city: string;
    state: string;
    aishe_code: string;
    website: string;
}

interface MockVerificationRow {
    id: string;
    user_id: string;
    college_id: string;
    status: "NOT_VERIFIED" | "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "INVALIDATED";
    document_type: string;
    document_paths: any[];
    extracted_data: any;
    student_name: string | null;
    enrollment_number: string | null;
    course_name: string | null;
    academic_year: string | null;
    institution_email: string | null;
    email_verified_at: Date | null;
    phone_number: string | null;
    phone_verified_at: Date | null;
    ocr_confidence: number;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    rejection_reason: string | null;
    reviewer_notes: string | null;
    created_at: Date;
    updated_at: Date;
}

interface MockEmailTokenRow {
    id: string;
    user_id: string;
    verification_id: string | null;
    institution_email: string;
    token_hash: string;
    status: "pending" | "verified" | "expired";
    expires_at: Date;
    verified_at: Date | null;
    created_at: Date;
}

interface MockPhoneOtpRow {
    id: string;
    user_id: string;
    verification_id: string | null;
    phone: string;
    otp_hash: string;
    status: "pending" | "verified" | "expired";
    attempts: number;
    expires_at: Date;
    verified_at: Date | null;
    created_at: Date;
}

class Mutex {
    private queue: Array<() => void> = [];
    private locked = false;

    async acquire(): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return () => this.release();
        }
        return new Promise<() => void>((resolve) => {
            this.queue.push(() => {
                this.locked = true;
                resolve(() => this.release());
            });
        });
    }

    private release() {
        const next = this.queue.shift();
        if (next) {
            next();
        } else {
            this.locked = false;
        }
    }
}

class InMemoryCollegeVerificationDb {
    public users = new Map<string, MockUser>();
    public institutions = new Map<string, MockInstitution>();
    public verifications = new Map<string, MockVerificationRow>();
    public emailTokens = new Map<string, MockEmailTokenRow>();
    public phoneOtps = new Map<string, MockPhoneOtpRow>();
    public capturedEmails: Array<{ to: string; token: string; verificationLink: string }> = [];
    public capturedSms: Array<{ to: string; otp: string }> = [];
    public uploadedPublicIds: string[] = [];
    public destroyedPublicIds: string[] = [];
    private rowLocks = new Map<string, Mutex>();

    private getRowLock(id: string): Mutex {
        let m = this.rowLocks.get(id);
        if (!m) {
            m = new Mutex();
            this.rowLocks.set(id, m);
        }
        return m;
    }

    public seedUser(user: MockUser) {
        this.users.set(user.id, { ...user });
    }

    public seedInstitution(inst: MockInstitution) {
        this.institutions.set(inst.id, { ...inst });
    }

    public async executeQuery(
        text: string,
        params: any[] = [],
        heldReleases?: Array<() => void>,
        txOverrides?: Map<string, MockVerificationRow>
    ): Promise<{ rows: any[]; rowCount: number }> {
        const sql = text.replace(/\s+/g, " ").trim();

        if (sql === "BEGIN;" || sql === "COMMIT;" || sql === "ROLLBACK;") {
            return { rows: [], rowCount: 0 };
        }

        // Lookup user for getStatus
        if (sql.includes("FROM users u LEFT JOIN institutions i ON u.college_id = i.id WHERE u.id = $1")) {
            const u = this.users.get(params[0]);
            if (!u) return { rows: [], rowCount: 0 };
            const inst = u.college_id ? this.institutions.get(u.college_id) : null;
            return {
                rowCount: 1,
                rows: [
                    {
                        id: u.id,
                        college_id: u.college_id,
                        college: u.college,
                        college_updated_at: u.college_updated_at,
                        instId: inst?.id || null,
                        instName: inst?.official_name || null,
                        city: inst?.city || null,
                        state: inst?.state || null,
                        aisheCode: inst?.aishe_code || null,
                        website: inst?.website || null,
                    },
                ],
            };
        }

        // Lookup user basic / sendInstitutionalEmailToken / submitApplication / sendPhoneOtp
        if (sql.startsWith("SELECT") && sql.includes("FROM users WHERE id = $1 LIMIT 1")) {
            const u = this.users.get(params[0]);
            return u ? { rowCount: 1, rows: [{ ...u }] } : { rowCount: 0, rows: [] };
        }

        if (sql.startsWith("SELECT username FROM users WHERE id = $1")) {
            const u = this.users.get(params[0]);
            return u ? { rowCount: 1, rows: [{ username: u.username }] } : { rowCount: 0, rows: [] };
        }

        // Institution lookup
        if (sql.startsWith("SELECT id, official_name, website FROM institutions WHERE id = $1 LIMIT 1")) {
            const inst = this.institutions.get(params[0]);
            return inst ? { rowCount: 1, rows: [{ ...inst }] } : { rowCount: 0, rows: [] };
        }

        // getStatus history query
        if (sql.includes("FROM college_verifications cv LEFT JOIN institutions i") && sql.includes("WHERE cv.user_id = $1")) {
            const userId = params[0];
            const list = [...this.verifications.values()]
                .filter((v) => v.user_id === userId)
                .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
                .map((v) => {
                    const inst = this.institutions.get(v.college_id);
                    const reviewer = v.reviewed_by ? this.users.get(v.reviewed_by) : null;
                    return {
                        ...v,
                        collegeName: inst?.official_name || null,
                        collegeCity: inst?.city || null,
                        collegeState: inst?.state || null,
                        reviewerUsername: reviewer?.username || null,
                    };
                });
            return { rowCount: list.length, rows: list };
        }

        // Duplicate active check or active verification lookup
        if (sql.startsWith("SELECT id") && sql.includes("FROM college_verifications WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING')")) {
            const found = [...this.verifications.values()].find(
                (v) => v.user_id === params[0] && (v.status === "PENDING" || v.status === "PROCESSING")
            );
            return found ? { rowCount: 1, rows: [{ id: found.id, status: found.status }] } : { rowCount: 0, rows: [] };
        }

        // Expire pending email tokens for user
        if (sql.startsWith("UPDATE college_verification_email_tokens SET status = 'expired' WHERE user_id = $1 AND status = 'pending'")) {
            let count = 0;
            for (const tok of this.emailTokens.values()) {
                if (tok.user_id === params[0] && tok.status === "pending") {
                    tok.status = "expired";
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        // Insert email token
        if (sql.startsWith("INSERT INTO college_verification_email_tokens")) {
            const row: MockEmailTokenRow = {
                id: crypto.randomUUID(),
                user_id: params[0],
                verification_id: params[1] || null,
                institution_email: params[2],
                token_hash: params[3],
                status: "pending",
                expires_at: params[4],
                verified_at: null,
                created_at: new Date(),
            };
            this.emailTokens.set(row.id, row);
            return { rowCount: 1, rows: [{ ...row }] };
        }

        // Find email token by hash
        if (sql.includes("FROM college_verification_email_tokens WHERE token_hash = $1")) {
            const found = [...this.emailTokens.values()].find((t) => t.token_hash === params[0]);
            return found ? { rowCount: 1, rows: [{ ...found }] } : { rowCount: 0, rows: [] };
        }

        // Mark email token expired by id
        if (sql.startsWith("UPDATE college_verification_email_tokens SET status = 'expired' WHERE id = $1")) {
            const tok = this.emailTokens.get(params[0]);
            if (tok) tok.status = "expired";
            return { rowCount: tok ? 1 : 0, rows: [] };
        }

        // Atomically mark email token verified
        if (sql.startsWith("UPDATE college_verification_email_tokens SET status = 'verified', verified_at = $1 WHERE id = $2 AND status = 'pending'")) {
            const tok = this.emailTokens.get(params[1]);
            if (!tok || tok.status !== "pending") return { rowCount: 0, rows: [] };
            tok.status = "verified";
            tok.verified_at = params[0];
            return { rowCount: 1, rows: [{ id: tok.id }] };
        }

        // Query unclaimed verified email token (exact address match)
        if (
            sql.includes("FROM college_verification_email_tokens") &&
            sql.includes("LOWER(institution_email) = LOWER($2)") &&
            sql.includes("verification_id IS NULL")
        ) {
            const found = [...this.emailTokens.values()]
                .filter(
                    (t) =>
                        t.user_id === params[0] &&
                        t.institution_email.toLowerCase() === String(params[1]).toLowerCase() &&
                        t.status === "verified" &&
                        t.verification_id === null
                )
                .sort((a, b) => (b.verified_at?.getTime() || 0) - (a.verified_at?.getTime() || 0))[0];
            return found ? { rowCount: 1, rows: [{ ...found }] } : { rowCount: 0, rows: [] };
        }

        // Query unclaimed verified email token for getStatus
        if (
            sql.includes("FROM college_verification_email_tokens") &&
            sql.includes("WHERE user_id = $1 AND status = 'verified' AND verification_id IS NULL")
        ) {
            const found = [...this.emailTokens.values()]
                .filter((t) => t.user_id === params[0] && t.status === "verified" && t.verification_id === null)
                .sort((a, b) => (b.verified_at?.getTime() || 0) - (a.verified_at?.getTime() || 0))[0];
            return found ? { rowCount: 1, rows: [{ ...found }] } : { rowCount: 0, rows: [] };
        }

        // Claim email token for verification_id
        if (sql.startsWith("UPDATE college_verification_email_tokens SET verification_id = $1 WHERE id = $2 AND user_id = $3")) {
            const tok = this.emailTokens.get(params[1]);
            if (!tok || tok.user_id !== params[2] || tok.status !== "verified" || tok.verification_id !== null) {
                return { rowCount: 0, rows: [] };
            }
            tok.verification_id = params[0];
            return { rowCount: 1, rows: [{ id: tok.id }] };
        }

        // Expire pending phone OTPs for user
        if (sql.startsWith("UPDATE college_verification_phone_otps SET status = 'expired' WHERE user_id = $1 AND status = 'pending'")) {
            let count = 0;
            for (const o of this.phoneOtps.values()) {
                if (o.user_id === params[0] && o.status === "pending") {
                    o.status = "expired";
                    count++;
                }
            }
            return { rowCount: count, rows: [] };
        }

        // Insert phone OTP
        if (sql.startsWith("INSERT INTO college_verification_phone_otps")) {
            const row: MockPhoneOtpRow = {
                id: crypto.randomUUID(),
                user_id: params[0],
                verification_id: params[1] || null,
                phone: params[2],
                otp_hash: params[3],
                status: "pending",
                attempts: 0,
                expires_at: params[4],
                verified_at: null,
                created_at: new Date(),
            };
            this.phoneOtps.set(row.id, row);
            return { rowCount: 1, rows: [{ ...row }] };
        }

        // Find pending phone OTP
        if (sql.includes("FROM college_verification_phone_otps WHERE user_id = $1 AND phone = $2 AND status = 'pending'")) {
            const found = [...this.phoneOtps.values()]
                .filter((o) => o.user_id === params[0] && o.phone === params[1] && o.status === "pending")
                .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
            return found ? { rowCount: 1, rows: [{ ...found }] } : { rowCount: 0, rows: [] };
        }

        // Phone OTP expiration / attempt increment
        if (sql.startsWith("UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1")) {
            const o = this.phoneOtps.get(params[0]);
            if (o) o.status = "expired";
            return { rowCount: o ? 1 : 0, rows: [] };
        }
        if (sql.startsWith("UPDATE college_verification_phone_otps SET attempts = attempts + 1 WHERE id = $1")) {
            const o = this.phoneOtps.get(params[0]);
            if (o) o.attempts += 1;
            return { rowCount: o ? 1 : 0, rows: [] };
        }

        // Atomically mark phone OTP verified
        if (sql.startsWith("UPDATE college_verification_phone_otps SET status = 'verified', verified_at = $1 WHERE id = $2 AND status = 'pending'")) {
            const o = this.phoneOtps.get(params[1]);
            if (!o || o.status !== "pending") return { rowCount: 0, rows: [] };
            o.status = "verified";
            o.verified_at = params[0];
            return { rowCount: 1, rows: [{ id: o.id }] };
        }

        // Query unclaimed verified phone OTP (exact canonical match)
        if (
            sql.includes("FROM college_verification_phone_otps") &&
            sql.includes("WHERE user_id = $1 AND phone = $2 AND status = 'verified' AND verification_id IS NULL")
        ) {
            const found = [...this.phoneOtps.values()]
                .filter((o) => o.user_id === params[0] && o.phone === params[1] && o.status === "verified" && o.verification_id === null)
                .sort((a, b) => (b.verified_at?.getTime() || 0) - (a.verified_at?.getTime() || 0))[0];
            return found ? { rowCount: 1, rows: [{ ...found }] } : { rowCount: 0, rows: [] };
        }

        // Query unclaimed verified phone OTP for getStatus
        if (
            sql.includes("FROM college_verification_phone_otps") &&
            sql.includes("WHERE user_id = $1 AND status = 'verified' AND verification_id IS NULL")
        ) {
            const found = [...this.phoneOtps.values()]
                .filter((o) => o.user_id === params[0] && o.status === "verified" && o.verification_id === null)
                .sort((a, b) => (b.verified_at?.getTime() || 0) - (a.verified_at?.getTime() || 0))[0];
            return found ? { rowCount: 1, rows: [{ ...found }] } : { rowCount: 0, rows: [] };
        }

        // Claim phone OTP for verification_id
        if (sql.startsWith("UPDATE college_verification_phone_otps SET verification_id = $1 WHERE id = $2 AND user_id = $3")) {
            const o = this.phoneOtps.get(params[1]);
            if (!o || o.user_id !== params[2] || o.status !== "verified" || o.verification_id !== null) {
                return { rowCount: 0, rows: [] };
            }
            o.verification_id = params[0];
            return { rowCount: 1, rows: [{ id: o.id }] };
        }

        // Update active college_verifications with email/phone post-submit
        if (sql.startsWith("UPDATE college_verifications SET institution_email = $1")) {
            for (const v of this.verifications.values()) {
                if (v.user_id === params[2] && (v.status === "PENDING" || v.status === "PROCESSING")) {
                    v.institution_email = params[0];
                    v.email_verified_at = params[1];
                }
            }
            return { rowCount: 0, rows: [] };
        }
        if (sql.startsWith("UPDATE college_verifications SET phone_number = $1")) {
            for (const v of this.verifications.values()) {
                if (v.user_id === params[2] && (v.status === "PENDING" || v.status === "PROCESSING")) {
                    v.phone_number = params[0];
                    v.phone_verified_at = params[1];
                }
            }
            return { rowCount: 0, rows: [] };
        }

        // Insert college_verifications
        if (sql.startsWith("INSERT INTO college_verifications")) {
            const now = new Date();
            const row: MockVerificationRow = {
                id: crypto.randomUUID(),
                user_id: params[0],
                college_id: params[1],
                status: "PENDING",
                document_type: params[2],
                document_paths: JSON.parse(params[3]),
                extracted_data: JSON.parse(params[4]),
                student_name: params[5],
                enrollment_number: params[6],
                course_name: params[7],
                academic_year: params[8],
                institution_email: params[9],
                email_verified_at: params[10],
                phone_number: params[11],
                phone_verified_at: params[12],
                ocr_confidence: params[13],
                reviewed_by: null,
                reviewed_at: null,
                rejection_reason: null,
                reviewer_notes: null,
                created_at: now,
                updated_at: now,
            };
            this.verifications.set(row.id, row);
            return { rowCount: 1, rows: [{ ...row }] };
        }

        // Approval pre-flight JOIN lookup
        if (sql.includes("FROM college_verifications cv JOIN users u ON cv.user_id = u.id WHERE cv.id = $1")) {
            const v = this.verifications.get(params[0]);
            if (!v) return { rowCount: 0, rows: [] };
            const u = this.users.get(v.user_id);
            return {
                rowCount: 1,
                rows: [
                    {
                        ...v,
                        userCollegeId: u?.college_id || null,
                        username: u?.username || "student",
                        firstname: u?.firstname || "Test",
                        lastname: u?.lastname || "User",
                        userAccountType: u?.account_type || "personal",
                    },
                ],
            };
        }

        // Approval atomic UPDATE with status IN ('PENDING', 'PROCESSING') AND email_verified_at IS NOT NULL AND phone_verified_at IS NOT NULL
        if (sql.includes("UPDATE college_verifications SET status = 'APPROVED'")) {
            assert.ok(/email_verified_at\s+IS\s+NOT\s+NULL/i.test(sql), "Approval SQL must guard email_verified_at IS NOT NULL");
            assert.ok(/phone_verified_at\s+IS\s+NOT\s+NULL/i.test(sql), "Approval SQL must guard phone_verified_at IS NOT NULL");
            const id = params[3];
            const lock = this.getRowLock(id);
            const rel = await lock.acquire();
            heldReleases?.push(rel);

            const current = this.verifications.get(id);
            if (
                !current ||
                (current.status !== "PENDING" && current.status !== "PROCESSING") ||
                !current.email_verified_at ||
                !current.phone_verified_at
            ) {
                return { rowCount: 0, rows: [] };
            }

            const updated: MockVerificationRow = {
                ...current,
                status: "APPROVED",
                reviewed_by: params[0],
                reviewed_at: params[1],
                reviewer_notes: params[2],
                updated_at: params[1],
            };
            txOverrides?.set(id, updated);
            return { rowCount: 1, rows: [{ ...updated }] };
        }

        // Diagnostic SELECT after zero-row update
        if (sql.includes("SELECT status, reviewed_by, reviewed_at, email_verified_at, phone_verified_at FROM college_verifications")) {
            const v = this.verifications.get(params[0]);
            return v ? { rowCount: 1, rows: [{ ...v }] } : { rowCount: 0, rows: [] };
        }

        // Prior APPROVED invalidation
        if (sql.includes("UPDATE college_verifications SET status = 'INVALIDATED'")) {
            for (const v of this.verifications.values()) {
                if (v.user_id === params[1] && v.status === "APPROVED" && v.id !== params[2]) {
                    v.status = "INVALIDATED";
                    v.updated_at = params[0];
                }
            }
            return { rowCount: 0, rows: [] };
        }

        // Update user badge on approval
        if (sql.startsWith("UPDATE users SET is_college_verified = true")) {
            const u = this.users.get(params[1]);
            if (u) {
                u.is_college_verified = true;
                u.college_verified_at = params[0];
            }
            return { rowCount: u ? 1 : 0, rows: [] };
        }

        // Notification insert (post-commit)
        if (sql.startsWith("INSERT INTO user_notifications")) {
            return { rowCount: 1, rows: [] };
        }

        return { rowCount: 0, rows: [] };
    }

    public createPool() {
        const db = this;
        return {
            connect: async () => {
                const heldReleases: Array<() => void> = [];
                const txOverrides = new Map<string, MockVerificationRow>();
                return {
                    query: async (text: string, params?: any[]) => {
                        const norm = text.trim();
                        if (norm === "COMMIT;") {
                            for (const [k, v] of txOverrides.entries()) {
                                db.verifications.set(k, v);
                            }
                            txOverrides.clear();
                            while (heldReleases.length > 0) heldReleases.shift()!();
                            return { rows: [], rowCount: 0 };
                        }
                        if (norm === "ROLLBACK;") {
                            txOverrides.clear();
                            while (heldReleases.length > 0) heldReleases.shift()!();
                            return { rows: [], rowCount: 0 };
                        }
                        return db.executeQuery(text, params, heldReleases, txOverrides);
                    },
                    release: () => {
                        while (heldReleases.length > 0) heldReleases.shift()!();
                    },
                };
            },
        };
    }

    public getChannelDeps(): VerificationChannelDeps {
        const db = this;
        return {
            query: (text: string, params?: any[]) => db.executeQuery(text, params),
            skipRateLimit: true,
            emailSender: async (opts) => {
                const token = opts.verificationLink.split("verify_college_email=")[1] || "";
                db.capturedEmails.push({ to: opts.to, token, verificationLink: opts.verificationLink });
                return { success: true, simulated: true };
            },
            smsSender: async (opts) => {
                db.capturedSms.push({ to: opts.to, otp: opts.otp });
                return { success: true, simulated: true };
            },
        };
    }

    public getSubmitDeps(): SubmitApplicationDeps {
        const db = this;
        return {
            pool: db.createPool(),
            query: (text: string, params?: any[]) => db.executeQuery(text, params),
            isCloudinaryConfigured: () => true,
            uploader: {
                upload_stream: (opts: any, cb: (err: any, res: any) => void) => ({
                    end: (buf: Buffer) => {
                        const publicId = `${opts.folder || "orbix/college_verifications"}/${crypto.randomUUID()}`;
                        db.uploadedPublicIds.push(publicId);
                        cb(null, { public_id: publicId, bytes: buf.length, format: opts.format || "png" });
                    },
                }),
                destroy: async (publicId: string) => {
                    db.destroyedPublicIds.push(publicId);
                    return { result: "ok" };
                },
            },
        };
    }

    public getApproveDeps(): ApproveApplicationDeps {
        const db = this;
        return {
            pool: db.createPool(),
            query: (text: string, params?: any[]) => db.executeQuery(text, params),
            cache: {
                deleteUserDetailsCache: async () => {},
                invalidateAllUserCaches: async () => {},
            },
        };
    }
}

async function runSuite() {
    console.log("=================================================");
    console.log("🔐 ORBIX STAGE 4.4B: MANDATORY EMAIL + PHONE OTP ENFORCEMENT SUITE");
    console.log("   (Isolated In-Memory Relational Store, Mock Mail/SMS/Cloudinary)");
    console.log("=================================================\n");

    let passed = 0;
    let failed = 0;

    async function runTest(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err: any) {
            console.error(`  ❌ FAIL: ${name}\n     ${err?.stack || err?.message}`);
            failed++;
        }
    }

    const validPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 0x41)]);

    function setupBaseDb() {
        const db = new InMemoryCollegeVerificationDb();
        db.seedInstitution({
            id: "inst-iitk",
            official_name: "Indian Institute of Technology Kanpur",
            city: "Kanpur",
            state: "UP",
            aishe_code: "U-0515",
            website: "https://iitk.ac.in",
        });
        db.seedUser({
            id: "user-student-1",
            college_id: "inst-iitk",
            college: "Indian Institute of Technology Kanpur",
            college_updated_at: null,
            account_type: "personal",
            firstname: "Aarav",
            lastname: "Sharma",
            username: "aarav_s",
            is_college_verified: false,
            college_verified_at: null,
        });
        return db;
    }

    // 1. Email missing -> submission rejected
    await runTest("1. Email missing -> submission rejected before document upload", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);
        const otp = db.capturedSms[0]!.otp;
        await CollegeVerificationService.verifyPhoneOtp({ userId: "user-student-1", phone: "9876543210", otp }, chDeps);

        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-student-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                        phoneNumber: "9876543210",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 400 && /institutional email/i.test(err.message)
        );
        assert.equal(db.uploadedPublicIds.length, 0, "Zero uploads should execute when email is missing");
        assert.equal(db.verifications.size, 0, "Zero application rows created");
    });

    // 2. Email unverified (pending token only) -> submission rejected
    await runTest("2. Email unverified -> submission rejected before document upload", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);
        await CollegeVerificationService.verifyPhoneOtp(
            { userId: "user-student-1", phone: "9876543210", otp: db.capturedSms[0]!.otp },
            chDeps
        );

        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-student-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                        institutionEmail: "aarav@iitk.ac.in",
                        phoneNumber: "9876543210",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 400 && /institutional email verification is incomplete/i.test(err.message)
        );
        assert.equal(db.uploadedPublicIds.length, 0);
        assert.equal(db.verifications.size, 0);
    });

    // 3. Phone missing -> submission rejected
    await runTest("3. Phone missing -> submission rejected before document upload", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.verifyInstitutionalEmailToken(
            db.capturedEmails[0]!.token,
            "user-student-1",
            undefined,
            chDeps
        );

        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-student-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                        institutionEmail: "aarav@iitk.ac.in",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 400 && /mobile phone number/i.test(err.message)
        );
        assert.equal(db.uploadedPublicIds.length, 0);
        assert.equal(db.verifications.size, 0);
    });

    // 4. Phone unverified (OTP sent, not verified) -> submission rejected
    await runTest("4. Phone unverified -> submission rejected before document upload", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.verifyInstitutionalEmailToken(
            db.capturedEmails[0]!.token,
            "user-student-1",
            undefined,
            chDeps
        );
        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);

        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-student-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                        institutionEmail: "aarav@iitk.ac.in",
                        phoneNumber: "9876543210",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 400 && /mobile phone otp verification is incomplete/i.test(err.message)
        );
        assert.equal(db.uploadedPublicIds.length, 0);
        assert.equal(db.verifications.size, 0);
    });

    // 5. Both verified -> getStatus reports verifiedChannels & submission succeeds & binds tokens to application ID
    await runTest("5. Both verified -> getStatus syncs channels, submission succeeds, & binds tokens to application", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.verifyInstitutionalEmailToken(
            db.capturedEmails[0]!.token,
            "user-student-1",
            undefined,
            chDeps
        );

        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);
        await CollegeVerificationService.verifyPhoneOtp(
            { userId: "user-student-1", phone: "9876543210", otp: db.capturedSms[0]!.otp },
            chDeps
        );

        const preStatus = await CollegeVerificationService.getStatus("user-student-1", chDeps);
        assert.equal(preStatus.verifiedChannels.email, "aarav@iitk.ac.in");
        assert.ok(preStatus.verifiedChannels.emailVerifiedAt);
        assert.equal(preStatus.verifiedChannels.phone, "+919876543210");
        assert.ok(preStatus.verifiedChannels.phoneVerifiedAt);

        const submitRes = await CollegeVerificationService.submitApplication(
            {
                userId: "user-student-1",
                collegeId: "inst-iitk",
                documentType: "student_id",
                files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                institutionEmail: "aarav@iitk.ac.in",
                phoneNumber: "9876543210",
                studentName: "Aarav Sharma",
            },
            db.getSubmitDeps()
        );

        assert.equal(submitRes.success, true);
        assert.equal(submitRes.application.status, "PENDING");
        assert.equal(submitRes.application.is_email_verified, true);
        assert.equal(submitRes.application.is_phone_verified, true);
        assert.ok(submitRes.application.email_verified_at);
        assert.ok(submitRes.application.phone_verified_at);

        // Assert relational claiming of verification_id
        const claimedEmail = [...db.emailTokens.values()][0]!;
        const claimedOtp = [...db.phoneOtps.values()][0]!;
        assert.equal(claimedEmail.verification_id, submitRes.application.id);
        assert.equal(claimedOtp.verification_id, submitRes.application.id);
    });

    // 6. Founder approval with missing email verification -> rejected
    await runTest("6. Founder approval with missing email_verified_at -> rejected (400)", async () => {
        const db = setupBaseDb();
        db.verifications.set("app-no-email", {
            id: "app-no-email",
            user_id: "user-student-1",
            college_id: "inst-iitk",
            status: "PENDING",
            document_type: "student_id",
            document_paths: [],
            extracted_data: {},
            student_name: "Aarav",
            enrollment_number: "101",
            course_name: "CS",
            academic_year: "2024",
            institution_email: "aarav@iitk.ac.in",
            email_verified_at: null,
            phone_number: "+919876543210",
            phone_verified_at: new Date(),
            ocr_confidence: 90,
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
            reviewer_notes: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        await assert.rejects(
            () => CollegeVerificationService.approveApplication("app-no-email", "founder-uuid-1", "Notes", db.getApproveDeps()),
            (err: any) => err.statusCode === 400 && /institutional email verification/i.test(err.message)
        );
        assert.equal(db.verifications.get("app-no-email")!.status, "PENDING");
    });

    // 7. Founder approval with missing phone OTP verification -> rejected
    await runTest("7. Founder approval with missing phone_verified_at -> rejected (400)", async () => {
        const db = setupBaseDb();
        db.verifications.set("app-no-phone", {
            id: "app-no-phone",
            user_id: "user-student-1",
            college_id: "inst-iitk",
            status: "PENDING",
            document_type: "student_id",
            document_paths: [],
            extracted_data: {},
            student_name: "Aarav",
            enrollment_number: "101",
            course_name: "CS",
            academic_year: "2024",
            institution_email: "aarav@iitk.ac.in",
            email_verified_at: new Date(),
            phone_number: "+919876543210",
            phone_verified_at: null,
            ocr_confidence: 90,
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
            reviewer_notes: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        await assert.rejects(
            () => CollegeVerificationService.approveApplication("app-no-phone", "founder-uuid-1", "Notes", db.getApproveDeps()),
            (err: any) => err.statusCode === 400 && /mobile phone otp verification/i.test(err.message)
        );
        assert.equal(db.verifications.get("app-no-phone")!.status, "PENDING");
    });

    // 8. Founder approval with both verified -> succeeds
    await runTest("8. Founder approval with both verified factors -> succeeds", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.verifyInstitutionalEmailToken(
            db.capturedEmails[0]!.token,
            "user-student-1",
            undefined,
            chDeps
        );
        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);
        await CollegeVerificationService.verifyPhoneOtp(
            { userId: "user-student-1", phone: "9876543210", otp: db.capturedSms[0]!.otp },
            chDeps
        );

        const submitted = await CollegeVerificationService.submitApplication(
            {
                userId: "user-student-1",
                collegeId: "inst-iitk",
                documentType: "student_id",
                files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                institutionEmail: "aarav@iitk.ac.in",
                phoneNumber: "9876543210",
            },
            db.getSubmitDeps()
        );

        const approved = await CollegeVerificationService.approveApplication(
            submitted.application.id,
            "founder-uuid-1",
            "Verified",
            db.getApproveDeps()
        );

        assert.equal(approved.success, true);
        assert.equal(approved.application.status, "APPROVED");
        assert.equal(approved.application.reviewed_by, "founder-uuid-1");
        assert.equal(db.users.get("user-student-1")!.is_college_verified, true);
    });

    // 9. Concurrent approval behavior remains protected
    await runTest("9. Concurrent founder approvals -> strictly 1 winner, loser gets 409 Conflict", async () => {
        const db = setupBaseDb();
        db.verifications.set("app-race", {
            id: "app-race",
            user_id: "user-student-1",
            college_id: "inst-iitk",
            status: "PENDING",
            document_type: "student_id",
            document_paths: [],
            extracted_data: {},
            student_name: "Aarav",
            enrollment_number: "101",
            course_name: "CS",
            academic_year: "2024",
            institution_email: "aarav@iitk.ac.in",
            email_verified_at: new Date(),
            phone_number: "+919876543210",
            phone_verified_at: new Date(),
            ocr_confidence: 90,
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
            reviewer_notes: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const results = await Promise.allSettled([
            CollegeVerificationService.approveApplication("app-race", "founder-a", "A wins", db.getApproveDeps()),
            CollegeVerificationService.approveApplication("app-race", "founder-b", "B races", db.getApproveDeps()),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

        assert.equal(fulfilled.length, 1);
        assert.equal(rejected.length, 1);
        assert.equal(rejected[0]!.reason.statusCode, 409);
        assert.equal(db.verifications.get("app-race")!.reviewed_by, "founder-a");
    });

    // 10. Client-forged verification flags/timestamps cannot bypass backend validation
    await runTest("10. Client-forged verification flags and timestamps cannot bypass backend validation", async () => {
        const db = setupBaseDb();
        const forgedParams: any = {
            userId: "user-student-1",
            collegeId: "inst-iitk",
            documentType: "student_id",
            files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
            institutionEmail: "forged@iitk.ac.in",
            phoneNumber: "9876543210",
            emailVerified: true,
            isEmailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            email_verified_at: new Date().toISOString(),
            phoneVerified: true,
            isPhoneVerified: true,
            phoneVerifiedAt: new Date().toISOString(),
            phone_verified_at: new Date().toISOString(),
        };

        await assert.rejects(
            () => CollegeVerificationService.submitApplication(forgedParams, db.getSubmitDeps()),
            (err: any) => err.statusCode === 400 && /institutional email verification is incomplete/i.test(err.message)
        );
        assert.equal(db.verifications.size, 0);
    });

    // 11. Swapping to unverified email after verifying another email fails
    await runTest("11. Swapping submitted email to an unverified address after verifying another fails", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "verified@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.verifyInstitutionalEmailToken(
            db.capturedEmails[0]!.token,
            "user-student-1",
            undefined,
            chDeps
        );
        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);
        await CollegeVerificationService.verifyPhoneOtp(
            { userId: "user-student-1", phone: "9876543210", otp: db.capturedSms[0]!.otp },
            chDeps
        );

        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-student-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                        institutionEmail: "spoofed@iitk.ac.in",
                        phoneNumber: "9876543210",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 400 && /institutional email verification is incomplete/i.test(err.message)
        );
    });

    // 12. Reusing previously claimed token/OTP across a second application fails
    await runTest("12. Previously claimed verification tokens cannot be reused after rejection", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        await CollegeVerificationService.verifyInstitutionalEmailToken(
            db.capturedEmails[0]!.token,
            "user-student-1",
            undefined,
            chDeps
        );
        await CollegeVerificationService.sendPhoneOtp({ userId: "user-student-1", phone: "9876543210" }, chDeps);
        await CollegeVerificationService.verifyPhoneOtp(
            { userId: "user-student-1", phone: "9876543210", otp: db.capturedSms[0]!.otp },
            chDeps
        );

        const app1 = await CollegeVerificationService.submitApplication(
            {
                userId: "user-student-1",
                collegeId: "inst-iitk",
                documentType: "student_id",
                files: [{ buffer: validPng, originalname: "id.png", mimetype: "image/png", size: validPng.length }],
                institutionEmail: "aarav@iitk.ac.in",
                phoneNumber: "9876543210",
            },
            db.getSubmitDeps()
        );

        // Mark App 1 rejected
        db.verifications.get(app1.application.id)!.status = "REJECTED";

        // Attempt App 2 without fresh email/phone verification
        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-student-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "id2.png", mimetype: "image/png", size: validPng.length }],
                        institutionEmail: "aarav@iitk.ac.in",
                        phoneNumber: "9876543210",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 400
        );
    });

    // 13. Wrong-user & unauthenticated email token redemption blocked
    await runTest("13. Unauthenticated (401) and cross-user (403) email token redemption strictly rejected", async () => {
        const db = setupBaseDb();
        const chDeps = db.getChannelDeps();

        await CollegeVerificationService.sendInstitutionalEmailToken(
            { userId: "user-student-1", email: "aarav@iitk.ac.in", collegeId: "inst-iitk" },
            chDeps
        );
        const token = db.capturedEmails[0]!.token;

        await assert.rejects(
            () => CollegeVerificationService.verifyInstitutionalEmailToken(token, undefined, undefined, chDeps),
            (err: any) => err.statusCode === 401
        );

        await assert.rejects(
            () => CollegeVerificationService.verifyInstitutionalEmailToken(token, "user-attacker-999", undefined, chDeps),
            (err: any) => err.statusCode === 403
        );
    });

    // 14. Club accounts excluded across email, phone, and submit endpoints
    await runTest("14. Club accounts strictly excluded (403) from college email, phone, and submission", async () => {
        const db = setupBaseDb();
        db.seedUser({
            id: "user-club-1",
            college_id: "inst-iitk",
            college: "Indian Institute of Technology Kanpur",
            college_updated_at: null,
            account_type: "club",
            firstname: "Robotics",
            lastname: "Club",
            username: "iitk_robotics",
            is_college_verified: false,
            college_verified_at: null,
        });
        const chDeps = db.getChannelDeps();

        await assert.rejects(
            () =>
                CollegeVerificationService.sendInstitutionalEmailToken(
                    { userId: "user-club-1", email: "club@iitk.ac.in", collegeId: "inst-iitk" },
                    chDeps
                ),
            (err: any) => err.statusCode === 403
        );

        await assert.rejects(
            () => CollegeVerificationService.sendPhoneOtp({ userId: "user-club-1", phone: "9876543210" }, chDeps),
            (err: any) => err.statusCode === 403
        );

        await assert.rejects(
            () =>
                CollegeVerificationService.submitApplication(
                    {
                        userId: "user-club-1",
                        collegeId: "inst-iitk",
                        documentType: "student_id",
                        files: [{ buffer: validPng, originalname: "club.png", mimetype: "image/png", size: validPng.length }],
                        institutionEmail: "club@iitk.ac.in",
                        phoneNumber: "9876543210",
                    },
                    db.getSubmitDeps()
                ),
            (err: any) => err.statusCode === 403
        );
    });

    console.log("\n=================================================");
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log("=================================================\n");

    try {
        if (redis && typeof redis.disconnect === "function") {
            redis.disconnect();
        }
    } catch {}

    process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});
