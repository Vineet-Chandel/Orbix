/**
 * ORBIX STAGE 4.4E/4.4F — PRODUCTION DELIVERY & DOCUMENT-PROXY SECURITY REGRESSION SUITE
 *
 * 100% Isolated In-Memory Doubles (Zero Backend/.env leakage, Zero Supabase DB, Zero Real Email/SMS Egress).
 * Exercises the ACTUAL sendVerificationSms, sendCollegeVerificationEmail, dispatchEmail,
 * sendVerificationEmail, CollegeVerificationService, and founder/document-proxy route handlers.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Block dotenv/config from reading Backend/.env into this isolated test process
const isolatedMissingEnvPath = path.join(os.tmpdir(), `orbix-delivery-sec-isolated-${process.pid}.env`);
process.env.NODE_ENV = "test";
process.env.DOTENV_PATH = isolatedMissingEnvPath;
process.env.DOTENV_CONFIG_PATH = isolatedMissingEnvPath;

for (const key of [
    "SUPABASE_DB_URL",
    "DATABASE_URL",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM_EMAIL",
    "GMAIL_APP_PASSWORD",
    "EMAIL_PROVIDER",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "JWT_SECRET",
    "DOCUMENT_PROXY_HMAC_SECRET",
    "ORBIX_FOUNDER_USER_IDS",
    "FRONTEND_URL",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_URL",
]) {
    delete process.env[key];
}

function withCapturedLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
    const logs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    const record = (...args: any[]) => {
        logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };

    console.log = record;
    console.warn = record;
    console.error = record;

    return fn()
        .then((result) => ({ result, logs }))
        .finally(() => {
            console.log = origLog;
            console.warn = origWarn;
            console.error = origError;
        });
}

function resetTestEnv(overrides: Record<string, string | undefined> = {}) {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.SMTP_FROM_EMAIL;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.FRONTEND_URL;
    delete process.env.JWT_SECRET;
    delete process.env.DOCUMENT_PROXY_HMAC_SECRET;
    delete process.env.ORBIX_FOUNDER_USER_IDS;

    for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined) {
            delete process.env[k];
        } else {
            process.env[k] = v;
        }
    }
}

class InMemoryChannelQuery {
    public emailTokens: any[] = [];
    public phoneOtps: any[] = [];
    private studentUser = {
        id: "user-sec-1",
        college_id: "inst-1",
        account_type: "personal",
        firstname: "Riya",
        lastname: "Verma",
        username: "riya_v",
    };
    private inst = {
        id: "inst-1",
        official_name: "National Institute of Technology",
        website: "https://nit.ac.in",
    };

    public query = async (sqlText: string, params: any[] = []) => {
        const sql = sqlText.replace(/\s+/g, " ").trim();

        if (sql.startsWith("SELECT") && sql.includes("FROM users WHERE id = $1 LIMIT 1")) {
            return { rows: params[0] === this.studentUser.id ? [{ ...this.studentUser }] : [], rowCount: 1 };
        }
        if (sql.startsWith("SELECT id, official_name, website FROM institutions WHERE id = $1 LIMIT 1")) {
            return { rows: params[0] === this.inst.id ? [{ ...this.inst }] : [], rowCount: 1 };
        }
        if (sql.includes("FROM college_verifications WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING')")) {
            return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith("UPDATE college_verification_email_tokens SET status = 'expired' WHERE user_id = $1 AND status = 'pending'")) {
            for (const row of this.emailTokens) {
                if (row.user_id === params[0] && row.status === "pending") row.status = "expired";
            }
            return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith("UPDATE college_verification_email_tokens SET status = 'expired' WHERE id = $1")) {
            const found = this.emailTokens.find((r) => r.id === params[0]);
            if (found) found.status = "expired";
            return { rows: [], rowCount: found ? 1 : 0 };
        }
        if (sql.startsWith("INSERT INTO college_verification_email_tokens")) {
            const row = {
                id: crypto.randomUUID(),
                user_id: params[0],
                verification_id: params[1],
                institution_email: params[2],
                token_hash: params[3],
                status: "pending",
                expires_at: params[4],
            };
            this.emailTokens.push(row);
            return { rows: [row], rowCount: 1 };
        }
        if (sql.startsWith("UPDATE college_verification_phone_otps SET status = 'expired' WHERE user_id = $1 AND status = 'pending'")) {
            for (const row of this.phoneOtps) {
                if (row.user_id === params[0] && row.status === "pending") row.status = "expired";
            }
            return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith("UPDATE college_verification_phone_otps SET status = 'expired' WHERE id = $1")) {
            const found = this.phoneOtps.find((r) => r.id === params[0]);
            if (found) found.status = "expired";
            return { rows: [], rowCount: found ? 1 : 0 };
        }
        if (sql.startsWith("INSERT INTO college_verification_phone_otps")) {
            const row = {
                id: crypto.randomUUID(),
                user_id: params[0],
                verification_id: params[1],
                phone: params[2],
                otp_hash: params[3],
                status: "pending",
                attempts: 0,
                expires_at: params[4],
            };
            this.phoneOtps.push(row);
            return { rows: [row], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
    };
}

async function runTests() {
    console.log("=================================================");
    console.log("🛡️  ORBIX STAGE 4.4E/4.4F — DELIVERY & PROXY SECURITY SUITE");
    console.log("   (100% Isolated From .env, Mocked Network/DB)");
    console.log("=================================================\n");

    const [
        { default: redis },
        { sendVerificationSms },
        { dispatchEmail, sendCollegeVerificationEmail, sendVerificationEmail },
        { CollegeVerificationService, getDocumentProxySigningSecret },
        { requireFounder },
        { founderCollegeVerificationRouter },
    ] = await Promise.all([
        import("../../../redis/client.js"),
        import("../../sms/smsGatewayService.js"),
        import("../../email/resendService.js"),
        import("../collegeVerificationService.js"),
        import("../../../middlewares/founder.middleware.js"),
        import("../../../Routes/verification/collegeVerificationRoutes.js"),
    ]);

    try {
        if (redis && typeof redis.disconnect === "function") {
            redis.disconnect();
        }
    } catch {}

    assert.equal(process.env.SUPABASE_DB_URL, undefined);
    assert.equal(process.env.RESEND_API_KEY, undefined);

    const originalEnv = { ...process.env };
    let passed = 0;
    let failed = 0;

    async function runCase(name: string, fn: () => Promise<void> | void) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err: any) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     ${err?.stack || err?.message || err}`);
            failed++;
        }
    }

    const tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix-proxy-test-"));
    const sampleFilename = "student_id_sample.png";
    fs.writeFileSync(path.join(tmpUploadDir, sampleFilename), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    try {
        // =========================================================================
        // 1. SMS HARDENING TESTS
        // =========================================================================
        await runCase("SMS 1: Production + missing Twilio credentials fails closed without simulation", async () => {
            resetTestEnv({ NODE_ENV: "production" });
            const otp = "482913";
            const { result, logs } = await withCapturedLogs(() =>
                sendVerificationSms({ to: "9876543210", otp })
            );
            assert.equal(result.success, false);
            assert.equal(result.simulated, false);
            assert.ok(result.error?.includes("not configured"));
            assert.ok(!logs.join("\n").includes(otp), "OTP must never appear in logs");

            const db = new InMemoryChannelQuery();
            let rejected = false;
            try {
                await withCapturedLogs(() =>
                    CollegeVerificationService.sendPhoneOtp(
                        { userId: "user-sec-1", phone: "9876543210" },
                        { query: db.query, skipRateLimit: true }
                    )
                );
            } catch (err: any) {
                rejected = true;
                assert.equal(err.statusCode, 503);
            }
            assert.equal(rejected, true, "sendPhoneOtp must throw when SMS delivery fails");
            assert.equal(db.phoneOtps[0]?.status, "expired", "Failed dispatch must expire inserted pending OTP");
        });

        await runCase("SMS 2: Production + configured Twilio failure (HTTP error & throw) fails without simulation", async () => {
            resetTestEnv({
                NODE_ENV: "production",
                TWILIO_ACCOUNT_SID: "AC_mock_sid_123456",
                TWILIO_AUTH_TOKEN: "mock_secret_twilio_token_999",
                TWILIO_PHONE_NUMBER: "+15551234567",
            });
            const otp = "739204";

            const httpFail = await withCapturedLogs(() =>
                sendVerificationSms({
                    to: "9876543210",
                    otp,
                    fetchImpl: (async () =>
                        ({
                            ok: false,
                            status: 401,
                            json: async () => ({ message: "Authenticate failed" }),
                        }) as any) as typeof fetch,
                })
            );
            assert.equal(httpFail.result.success, false);
            assert.equal(httpFail.result.simulated, false);
            assert.ok(!httpFail.logs.join("\n").includes(otp));
            assert.ok(!httpFail.logs.join("\n").includes("mock_secret_twilio_token_999"));

            const netFail = await withCapturedLogs(() =>
                sendVerificationSms({
                    to: "9876543210",
                    otp,
                    fetchImpl: (async () => {
                        throw new Error(`ECONNRESET ${otp}`);
                    }) as unknown as typeof fetch,
                })
            );
            assert.equal(netFail.result.success, false);
            assert.equal(netFail.result.simulated, false);
            assert.ok(!netFail.logs.join("\n").includes(otp));

            const db = new InMemoryChannelQuery();
            let threw = false;
            try {
                await withCapturedLogs(() =>
                    CollegeVerificationService.sendPhoneOtp(
                        { userId: "user-sec-1", phone: "9876543210" },
                        {
                            query: db.query,
                            skipRateLimit: true,
                            smsSender: async () => ({ success: false, providerError: "Twilio 500", error: "Failed" }),
                        }
                    )
                );
            } catch (err: any) {
                threw = true;
                assert.equal(err.statusCode, 502);
            }
            assert.equal(threw, true);
            assert.equal(db.phoneOtps[0]?.status, "expired");
        });

        await runCase("SMS 3: Production + successful Twilio dispatch returns success & logs no OTP", async () => {
            resetTestEnv({
                NODE_ENV: "production",
                TWILIO_ACCOUNT_SID: "AC_mock_sid_123456",
                TWILIO_AUTH_TOKEN: "mock_secret_twilio_token_999",
                TWILIO_PHONE_NUMBER: "+15551234567",
            });
            const otp = "915382";
            const { result, logs } = await withCapturedLogs(() =>
                sendVerificationSms({
                    to: "9876543210",
                    otp,
                    fetchImpl: (async () =>
                        ({
                            ok: true,
                            status: 201,
                            json: async () => ({ sid: "SM_mock_success_001" }),
                        }) as any) as typeof fetch,
                })
            );
            assert.equal(result.success, true);
            assert.equal(result.simulated, false);
            assert.equal(result.messageId, "SM_mock_success_001");
            assert.ok(!logs.join("\n").includes(otp));
            assert.ok(!logs.join("\n").includes("mock_secret_twilio_token_999"));
        });

        await runCase("SMS 4: Development simulation preserved & OTP redacted from logs", async () => {
            resetTestEnv({ NODE_ENV: "development" });
            const otp = "604819";
            const { result, logs } = await withCapturedLogs(() =>
                sendVerificationSms({ to: "9876543210", otp })
            );
            assert.equal(result.success, true);
            assert.equal(result.simulated, true);
            assert.ok(!logs.join("\n").includes(otp));
        });

        // =========================================================================
        // 2. EMAIL HARDENING TESTS
        // =========================================================================
        await runCase("Email 1: Production + no provider (or unverified @resend.dev sender) fails closed", async () => {
            resetTestEnv({ NODE_ENV: "production", FRONTEND_URL: "https://orbix.dev" });
            const token = "a".repeat(64);
            const link = `https://orbix.dev/profile?verify_college_email=${token}`;

            const noProv = await withCapturedLogs(() =>
                sendCollegeVerificationEmail({
                    to: "student@nit.ac.in",
                    studentName: "Riya",
                    collegeName: "NIT",
                    verificationLink: link,
                })
            );
            assert.equal(noProv.result.success, false);
            assert.equal(noProv.result.simulated, false);
            assert.ok(!noProv.logs.join("\n").includes(token));
            assert.ok(!noProv.logs.join("\n").includes(link));

            resetTestEnv({
                NODE_ENV: "production",
                FRONTEND_URL: "https://orbix.dev",
                RESEND_API_KEY: "re_test_key_12345",
                RESEND_FROM_EMAIL: "Orbix <onboarding@resend.dev>",
            });
            const sandboxFail = await withCapturedLogs(() =>
                sendCollegeVerificationEmail({
                    to: "student@nit.ac.in",
                    studentName: "Riya",
                    collegeName: "NIT",
                    verificationLink: link,
                })
            );
            assert.equal(sandboxFail.result.success, false);
            assert.equal(sandboxFail.result.simulated, false);
            assert.equal(sandboxFail.result.sandboxRestricted, true);
            assert.ok(!sandboxFail.logs.join("\n").includes(token));

            resetTestEnv({ NODE_ENV: "production", FRONTEND_URL: "https://orbix.dev" });
            const db = new InMemoryChannelQuery();
            let rejected = false;
            try {
                await withCapturedLogs(() =>
                    CollegeVerificationService.sendInstitutionalEmailToken(
                        { userId: "user-sec-1", email: "riya@nit.ac.in", collegeId: "inst-1" },
                        { query: db.query, skipRateLimit: true }
                    )
                );
            } catch (err: any) {
                rejected = true;
                assert.equal(err.statusCode, 503);
            }
            assert.equal(rejected, true);
            assert.equal(db.emailTokens[0]?.status, "expired");
        });

        await runCase("Email 2: Production + configured Resend/SMTP provider failure fails closed without simulation", async () => {
            resetTestEnv({
                NODE_ENV: "production",
                FRONTEND_URL: "https://orbix.dev",
                RESEND_API_KEY: "re_test_key_12345",
                RESEND_FROM_EMAIL: "Orbix Security <verify@orbix.dev>",
            });
            const token = "b".repeat(64);
            const link = `https://orbix.dev/profile?verify_college_email=${token}`;

            const resendFail = await withCapturedLogs(() =>
                sendCollegeVerificationEmail(
                    {
                        to: "student@nit.ac.in",
                        studentName: "Riya",
                        collegeName: "NIT",
                        verificationLink: link,
                    },
                    {
                        resendClient: { emails: { send: async () => ({ error: { message: "Resend service unavailable" } }) } },
                        smtpTransporter: null,
                    }
                )
            );
            assert.equal(resendFail.result.success, false);
            assert.equal(resendFail.result.simulated, false);
            assert.equal(resendFail.result.provider, "resend");
            assert.ok(!resendFail.logs.join("\n").includes(token));
            assert.ok(!resendFail.logs.join("\n").includes(link));

            const smtpFail = await withCapturedLogs(() =>
                dispatchEmail(
                    {
                        to: "student@nit.ac.in",
                        subject: "Test",
                        html: `<a href="${link}">Verify</a>`,
                        text: link,
                        fromName: "Orbix",
                        defaultFromEmail: "verify@orbix.dev",
                        logContext: "Test SMTP failure",
                    },
                    {
                        resendClient: null,
                        smtpTransporter: {
                            sendMail: async () => {
                                throw new Error("SMTP auth failure");
                            },
                        },
                    }
                )
            );
            assert.equal(smtpFail.result.success, false);
            assert.equal(smtpFail.result.simulated, false);
            assert.equal(smtpFail.result.provider, "smtp");
            assert.ok(!smtpFail.logs.join("\n").includes(token));
        });

        await runCase("Email 3: Production + successful provider dispatch succeeds cleanly with zero token logs", async () => {
            resetTestEnv({
                NODE_ENV: "production",
                FRONTEND_URL: "https://orbix.dev",
                RESEND_API_KEY: "re_test_key_12345",
                RESEND_FROM_EMAIL: "Orbix Security <verify@orbix.dev>",
            });
            const token = "c".repeat(64);
            const link = `https://orbix.dev/profile?verify_college_email=${token}`;

            const { result, logs } = await withCapturedLogs(() =>
                sendCollegeVerificationEmail(
                    {
                        to: "student@nit.ac.in",
                        studentName: "Riya",
                        collegeName: "NIT",
                        verificationLink: link,
                    },
                    {
                        resendClient: { emails: { send: async () => ({ data: { id: "msg_mock_resend_1" } }) } },
                        smtpTransporter: null,
                    }
                )
            );
            assert.equal(result.success, true);
            assert.equal(result.simulated, false);
            assert.equal(result.provider, "resend");
            assert.equal(result.messageId, "msg_mock_resend_1");
            assert.ok(!logs.join("\n").includes(token));
            assert.ok(!logs.join("\n").includes(link));
        });

        await runCase("Email 4: Development simulation preserved & OTP/tokens redacted from logs", async () => {
            resetTestEnv({ NODE_ENV: "development" });
            const otp = "519283";
            const token = "d".repeat(64);
            const link = `http://localhost:5173/profile?verify_college_email=${token}`;

            const emailOtpRes = await withCapturedLogs(() =>
                sendVerificationEmail({ to: "dev@nit.ac.in", name: "Dev", otp })
            );
            assert.equal(emailOtpRes.result.success, true);
            assert.equal(emailOtpRes.result.simulated, true);
            assert.equal(emailOtpRes.result.provider, "simulation");
            assert.ok(!emailOtpRes.logs.join("\n").includes(otp));

            const collegeEmailRes = await withCapturedLogs(() =>
                sendCollegeVerificationEmail({
                    to: "dev@nit.ac.in",
                    studentName: "Dev",
                    collegeName: "NIT",
                    verificationLink: link,
                })
            );
            assert.equal(collegeEmailRes.result.success, true);
            assert.equal(collegeEmailRes.result.simulated, true);
            assert.ok(!collegeEmailRes.logs.join("\n").includes(token));
            assert.ok(!collegeEmailRes.logs.join("\n").includes(link));
        });

        // =========================================================================
        // 3. DEDICATED DOCUMENT-PROXY SIGNING SECRET (DOCUMENT_PROXY_HMAC_SECRET)
        // =========================================================================
        const localDoc = {
            storage: "local" as const,
            filename: sampleFilename,
            originalName: "id_card.png",
            mimeType: "image/png",
            size: 1024,
            format: "png",
            uploadedAt: new Date().toISOString(),
        };
        const strongProxySecret = "dedicated_document_proxy_hmac_secret_production_64chars_min_ok";
        const unrelatedStrongJwtSecret = "separate_auth_jwt_secret_that_must_never_be_reused_as_proxy_fallback";

        await runCase("Proxy 1: Production + missing/weak/placeholder DOCUMENT_PROXY_HMAC_SECRET fails closed even when JWT_SECRET is strong", async () => {
            for (const badSecret of [
                undefined,
                "",
                "short_123",
                "orbix_secret_fallback_key_2026",
                "your_document_proxy_hmac_secret_here_minimum_32_characters",
            ]) {
                resetTestEnv({
                    NODE_ENV: "production",
                    DOCUMENT_PROXY_HMAC_SECRET: badSecret,
                    JWT_SECRET: unrelatedStrongJwtSecret,
                });

                assert.throws(() => getDocumentProxySigningSecret(), /DOCUMENT_PROXY_HMAC_SECRET/i);
                assert.throws(() => CollegeVerificationService.generateSignedDocumentUrl(localDoc), /DOCUMENT_PROXY_HMAC_SECRET/i);
                assert.throws(
                    () => CollegeVerificationService.resolveDocumentFromProxyToken("abc.def", tmpUploadDir),
                    (err: any) => {
                        if (badSecret && badSecret.length > 0) {
                            assert.ok(!String(err.message).includes(badSecret), "Error must never reveal secret value");
                        }
                        assert.ok(!String(err.message).includes(unrelatedStrongJwtSecret));
                        return /DOCUMENT_PROXY_HMAC_SECRET/i.test(err.message);
                    }
                );
            }
        });

        await runCase("Proxy 2: Development unconfigured uses ephemeral per-process secret (not hardcoded) with notice log", async () => {
            resetTestEnv({ NODE_ENV: "development", JWT_SECRET: unrelatedStrongJwtSecret });
            let devSecret = "";
            const { logs } = await withCapturedLogs(async () => {
                devSecret = getDocumentProxySigningSecret();
            });
            assert.ok(devSecret.length >= 32, "Ephemeral dev secret must be cryptographically strong");
            assert.notEqual(devSecret, unrelatedStrongJwtSecret, "Must not fall back to JWT_SECRET in dev either");
            assert.notEqual(devSecret, "orbix_secret_fallback_key_2026");
            assert.ok(logs.join("\n").includes("ephemeral development-only"), "Explicit notice must be logged once");
            assert.ok(!logs.join("\n").includes(devSecret), "Ephemeral secret value must never be logged");
        });

        await runCase("Proxy 3: Dedicated secret signs & verifies; rejects JWT_SECRET-signed, hardcoded-fallback, tampered, traversal & expired tokens", async () => {
            resetTestEnv({
                NODE_ENV: "production",
                DOCUMENT_PROXY_HMAC_SECRET: strongProxySecret,
                JWT_SECRET: unrelatedStrongJwtSecret,
            });

            const signedUrl = CollegeVerificationService.generateSignedDocumentUrl(localDoc);
            assert.ok(signedUrl.startsWith("/api/internal/college-verifications/document-proxy/"));
            const token = signedUrl.split("/").pop()!;

            const resolved = CollegeVerificationService.resolveDocumentFromProxyToken(token, tmpUploadDir);
            assert.ok(resolved);
            assert.equal(path.basename(resolved.filePath), sampleFilename);
            assert.equal(resolved.mimeType, "image/png");

            // Token signed with JWT_SECRET MUST be rejected
            const jwtPayload = JSON.stringify({ f: sampleFilename, exp: Math.floor(Date.now() / 1000) + 300 });
            const jwtHmac = crypto.createHmac("sha256", unrelatedStrongJwtSecret).update(jwtPayload).digest("hex");
            const jwtToken = Buffer.from(`${jwtPayload}::${jwtHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(jwtToken, tmpUploadDir), null);

            // Hardcoded legacy fallback token MUST be rejected
            const fallbackHmac = crypto.createHmac("sha256", "orbix_secret_fallback_key_2026").update(jwtPayload).digest("hex");
            const fallbackToken = Buffer.from(`${jwtPayload}::${fallbackHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(fallbackToken, tmpUploadDir), null);

            // Tampered payload
            const tamperedPayload = JSON.stringify({ f: "other.png", exp: Math.floor(Date.now() / 1000) + 300 });
            const origHmac = Buffer.from(token, "base64url").toString("utf8").split("::")[1];
            const tamperedToken = Buffer.from(`${tamperedPayload}::${origHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(tamperedToken, tmpUploadDir), null);

            // Expired token
            const expPayload = JSON.stringify({ f: sampleFilename, exp: Math.floor(Date.now() / 1000) - 30 });
            const expHmac = crypto.createHmac("sha256", strongProxySecret).update(expPayload).digest("hex");
            const expToken = Buffer.from(`${expPayload}::${expHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(expToken, tmpUploadDir), null);

            // Traversal attempt
            const travPayload = JSON.stringify({ f: "../../etc/passwd", exp: Math.floor(Date.now() / 1000) + 300 });
            const travHmac = crypto.createHmac("sha256", strongProxySecret).update(travPayload).digest("hex");
            const travToken = Buffer.from(`${travPayload}::${travHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(travToken, tmpUploadDir), null);
        });

        await runCase("Proxy 4: Route authorization (401/403) and fail-closed 500 handler on missing proxy secret", async () => {
            const founderId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
            const nonFounderId = "11111111-2222-4333-8444-555555555555";
            resetTestEnv({
                NODE_ENV: "production",
                ORBIX_FOUNDER_USER_IDS: founderId,
                JWT_SECRET: unrelatedStrongJwtSecret,
            });

            const makeRes = () => {
                const state = { status: 200, body: null as any };
                return {
                    state,
                    status(code: number) {
                        state.status = code;
                        return this;
                    },
                    json(payload: any) {
                        state.body = payload;
                        return this;
                    },
                    send(payload: any) {
                        state.body = payload;
                        return this;
                    },
                    setHeader() {},
                    sendFile() {},
                };
            };

            const res401 = makeRes();
            await requireFounder({} as any, res401 as any, () => assert.fail("Must not pass 401"));
            assert.equal(res401.state.status, 401);

            const res403 = makeRes();
            await requireFounder({ user: { id: nonFounderId } } as any, res403 as any, () => assert.fail("Must not pass 403"));
            assert.equal(res403.state.status, 403);

            // Exercise the actual /document-proxy/:token route final handler when secret missing in production
            const proxyLayer = founderCollegeVerificationRouter.stack.find(
                (l: any) => l.route?.path === "/document-proxy/:token"
            );
            assert.ok(proxyLayer?.route, "Document-proxy route must exist on founderCollegeVerificationRouter");
            const routeStack = proxyLayer.route.stack;
            const finalLayer = routeStack[routeStack.length - 1];
            assert.ok(finalLayer, "Document-proxy route must have a handler");
            const finalHandler = finalLayer.handle;
            const res500 = makeRes();
            await finalHandler({ params: { token: "any.token" }, user: { id: founderId } } as any, res500 as any, () => {});
            assert.equal(res500.state.status, 500);
            assert.equal(res500.state.body?.success, false);
        });
    } finally {
        process.env = originalEnv;
        try {
            fs.rmSync(tmpUploadDir, { recursive: true, force: true });
        } catch {}
    }

    console.log("\n=================================================");
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log("=================================================\n");
    if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
    console.error("Test suite fatal error:", err);
    process.exit(1);
});
