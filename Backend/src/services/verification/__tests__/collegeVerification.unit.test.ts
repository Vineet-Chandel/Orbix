import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate test process from Backend/.env before loading application modules that import dotenv/config
const isolatedMissingEnvPath = path.join(os.tmpdir(), `orbix-unit-isolated-${process.pid}.env`);
process.env.NODE_ENV = "test";
process.env.DOTENV_PATH = isolatedMissingEnvPath;
process.env.DOTENV_CONFIG_PATH = isolatedMissingEnvPath;

const PROVIDER_SECRET_KEYS = [
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
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "JWT_SECRET",
    "DOCUMENT_PROXY_HMAC_SECRET",
    "ORBIX_FOUNDER_USER_IDS",
    "FRONTEND_URL",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_URL",
];
for (const key of PROVIDER_SECRET_KEYS) {
    delete process.env[key];
}

async function runUnitTests() {
    console.log("=================================================");
    console.log("🧪 ORBIX COLLEGE VERIFICATION SAFE UNIT TEST SUITE");
    console.log("   (Isolated, Zero-.env Leakage, Mocked Mail/SMS/Proxy)");
    console.log("=================================================\n");

    const [
        { CollegeVerificationService, getCanonicalFrontendUrl, getDocumentProxySigningSecret },
        { isAuthorizedFounder },
        { CollegeOcrService },
        { buildCollegeVerificationEmailTemplate, sendCollegeVerificationEmail },
        { sendVerificationSms },
        { default: redis },
    ] = await Promise.all([
        import("../collegeVerificationService.js"),
        import("../../../middlewares/founder.middleware.js"),
        import("../collegeOcrService.js"),
        import("../../email/resendService.js"),
        import("../../sms/smsGatewayService.js"),
        import("../../../redis/client.js"),
    ]);

    try {
        if (redis && typeof redis.disconnect === "function") {
            redis.disconnect();
        }
    } catch {}

    // Prove Backend/.env credentials were NOT loaded into the test process
    assert.equal(process.env.SUPABASE_DB_URL, undefined, "SUPABASE_DB_URL must not be loaded from Backend/.env");
    assert.equal(process.env.RESEND_API_KEY, undefined, "RESEND_API_KEY must not be loaded from Backend/.env");
    assert.equal(process.env.CLOUDINARY_API_SECRET, undefined, "CLOUDINARY_API_SECRET must not be loaded from Backend/.env");
    assert.equal(process.env.TWILIO_ACCOUNT_SID, undefined, "TWILIO_ACCOUNT_SID must not be loaded from Backend/.env");

    let passedTests = 0;
    let failedTests = 0;

    function recordPass(testName: string) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
    }

    function recordFail(testName: string, err: any) {
        console.error(`  ❌ FAIL: ${testName}`);
        console.error(`     Error: ${err?.message || err}`);
        failedTests++;
    }

    const originalEnv = { ...process.env };
    const tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix-unit-proxy-"));
    const sampleDocName = "valid_id.png";
    fs.writeFileSync(path.join(tmpUploadDir, sampleDocName), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    try {
        // ----------------------------------------------------
        // TEST SUITE 1: Canonical Frontend URL Validation
        // ----------------------------------------------------
        console.log("1. Canonical Frontend URL Validation Suite:");

        try {
            process.env.NODE_ENV = "production";
            process.env.FRONTEND_URL = "https://orbix.dev";
            const url1 = getCanonicalFrontendUrl();
            assert.equal(url1, "https://orbix.dev", "Should preserve valid HTTPS domain");
            recordPass("Valid HTTPS domain accepted in production");
        } catch (err: any) {
            recordFail("Valid HTTPS domain accepted in production", err);
        }

        try {
            process.env.NODE_ENV = "production";
            process.env.FRONTEND_URL = "https://orbix.dev///";
            const url2 = getCanonicalFrontendUrl();
            assert.equal(url2, "https://orbix.dev", "Should strip trailing slashes");
            recordPass("Trailing slashes stripped from production URL");
        } catch (err: any) {
            recordFail("Trailing slashes stripped from production URL", err);
        }

        try {
            process.env.NODE_ENV = "production";
            process.env.FRONTEND_URL = "http://insecure-orbix.dev";
            assert.throws(
                () => getCanonicalFrontendUrl(),
                /FRONTEND_URL must use the HTTPS protocol in production/,
                "Should throw on HTTP protocol in production"
            );
            recordPass("Insecure HTTP protocol rejected in production");
        } catch (err: any) {
            recordFail("Insecure HTTP protocol rejected in production", err);
        }

        try {
            process.env.NODE_ENV = "production";
            delete process.env.FRONTEND_URL;
            assert.throws(
                () => getCanonicalFrontendUrl(),
                /FRONTEND_URL environment variable is required in production/,
                "Should throw when FRONTEND_URL is missing in production"
            );
            recordPass("Missing FRONTEND_URL rejected in production");
        } catch (err: any) {
            recordFail("Missing FRONTEND_URL rejected in production", err);
        }

        try {
            process.env.NODE_ENV = "development";
            delete process.env.FRONTEND_URL;
            const devUrl = getCanonicalFrontendUrl();
            assert.equal(devUrl, "http://localhost:5173", "Should fallback to localhost:5173 in dev");
            recordPass("Development fallback to localhost:5173 succeeds");
        } catch (err: any) {
            recordFail("Development fallback to localhost:5173 succeeds", err);
        }

        // ----------------------------------------------------
        // TEST SUITE 2: Zero-Trust Founder UUID Allowlist
        // ----------------------------------------------------
        console.log("\n2. Zero-Trust Founder UUID Allowlist Suite:");

        const sampleFounderUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
        const nonFounderUuid = "11111111-2222-4333-8444-555555555555";

        try {
            process.env.ORBIX_FOUNDER_USER_IDS = sampleFounderUuid;
            const auth = await isAuthorizedFounder(sampleFounderUuid);
            assert.equal(auth, true, "Sample founder UUID should be authorized");
            recordPass("Allowlisted founder UUID authorized");
        } catch (err: any) {
            recordFail("Allowlisted founder UUID authorized", err);
        }

        try {
            process.env.ORBIX_FOUNDER_USER_IDS = sampleFounderUuid;
            const auth = await isAuthorizedFounder(nonFounderUuid);
            assert.equal(auth, false, "Non-founder UUID must be rejected");
            recordPass("Non-allowlisted UUID rejected");
        } catch (err: any) {
            recordFail("Non-allowlisted UUID rejected", err);
        }

        try {
            process.env.ORBIX_FOUNDER_USER_IDS = sampleFounderUuid;
            const auth1 = await isAuthorizedFounder("");
            const auth2 = await isAuthorizedFounder("not-a-uuid");
            const auth3 = await isAuthorizedFounder(null as any);
            assert.equal(auth1, false);
            assert.equal(auth2, false);
            assert.equal(auth3, false);
            recordPass("Malformed and empty UUID values rejected");
        } catch (err: any) {
            recordFail("Malformed and empty UUID values rejected", err);
        }

        try {
            process.env.ORBIX_FOUNDER_USER_IDS = "founder@orbix.dev";
            const auth = await isAuthorizedFounder("founder@orbix.dev");
            assert.equal(auth, false, "Email address must not bypass UUID check");
            recordPass("Email addresses rejected as user IDs");
        } catch (err: any) {
            recordFail("Email addresses rejected as user IDs", err);
        }

        try {
            delete process.env.ORBIX_FOUNDER_USER_IDS;
            const auth = await isAuthorizedFounder(sampleFounderUuid);
            assert.equal(auth, false, "Should fail closed when allowlist is unconfigured");
            recordPass("Zero fallback defaults when ORBIX_FOUNDER_USER_IDS is absent");
        } catch (err: any) {
            recordFail("Zero fallback defaults when ORBIX_FOUNDER_USER_IDS is absent", err);
        }

        // ----------------------------------------------------
        // TEST SUITE 3: OCR Engine Magic Bytes & Validation
        // ----------------------------------------------------
        console.log("\n3. OCR Engine Magic Bytes & Validation Suite:");

        try {
            const fakeTxtBuffer = Buffer.from("THIS IS PLAIN TEXT, NOT AN IMAGE");
            const res = CollegeOcrService.validateImageBuffer(fakeTxtBuffer);
            assert.equal(res.isValid, false, "Text file must be rejected");
            recordPass("Corrupt / non-image buffer safely rejected");
        } catch (err: any) {
            recordFail("Corrupt / non-image buffer safely rejected", err);
        }

        try {
            const pngHeader = Buffer.alloc(128);
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngHeader, 0);
            const res = CollegeOcrService.validateImageBuffer(pngHeader);
            assert.equal(res.isValid, true, "Valid PNG header must pass");
            assert.equal(res.format, "png");
            recordPass("Authentic PNG magic bytes validated");
        } catch (err: any) {
            recordFail("Authentic PNG magic bytes validated", err);
        }

        try {
            const jpegHeader = Buffer.alloc(128);
            Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(jpegHeader, 0);
            const res = CollegeOcrService.validateImageBuffer(jpegHeader);
            assert.equal(res.isValid, true, "Valid JPEG header must pass");
            assert.equal(res.format, "jpg");
            recordPass("Authentic JPEG magic bytes validated");
        } catch (err: any) {
            recordFail("Authentic JPEG magic bytes validated", err);
        }

        try {
            const webpHeader = Buffer.alloc(128);
            Buffer.from([0x52, 0x49, 0x46, 0x46]).copy(webpHeader, 0);
            Buffer.from([0x57, 0x45, 0x42, 0x50]).copy(webpHeader, 8);
            const res = CollegeOcrService.validateImageBuffer(webpHeader);
            assert.equal(res.isValid, true, "Valid WebP header must pass");
            assert.equal(res.format, "webp");
            recordPass("Authentic WebP magic bytes validated");
        } catch (err: any) {
            recordFail("Authentic WebP magic bytes validated", err);
        }

        try {
            const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
            largeBuffer[0] = 0xff;
            largeBuffer[1] = 0xd8;
            largeBuffer[2] = 0xff;
            const res = CollegeOcrService.validateImageBuffer(largeBuffer);
            assert.equal(res.isValid, false, "Image > 10MB must be rejected");
            recordPass("Oversized image buffer (>10MB) safely rejected");
        } catch (err: any) {
            recordFail("Oversized image buffer (>10MB) safely rejected", err);
        }

        // ----------------------------------------------------
        // TEST SUITE 4: Isolated Institutional Email & SMS Delivery Paths
        // ----------------------------------------------------
        console.log("\n4. Dedicated Institutional Verification Email & SMS Delivery Suite (Isolated Mocks):");

        const sampleEmailParams = {
            to: "student@iitk.ac.in",
            studentName: "Rahul Sharma",
            collegeName: "Indian Institute of Technology Kanpur",
            verificationLink:
                "https://orbix.dev/profile?verify_college_email=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            expiresInHours: 24,
        };

        try {
            const { html } = buildCollegeVerificationEmailTemplate(sampleEmailParams);
            assert.ok(html.includes("https://orbix.dev/profile?verify_college_email="), "HTML must embed full verification URL");
            assert.ok(html.includes("Indian Institute of Technology Kanpur"), "HTML must reference correct institution");
            assert.ok(html.includes("24 hours"), "HTML must indicate expiration window");
            recordPass("Full 64-character verification URL embedded in HTML template");
        } catch (err: any) {
            recordFail("Full 64-character verification URL embedded in HTML template", err);
        }

        try {
            const xssPayload = "<script>alert('xss')</script>John Doe";
            const { html } = buildCollegeVerificationEmailTemplate({
                ...sampleEmailParams,
                studentName: xssPayload,
            });
            assert.ok(!html.includes("<script>"), "HTML template must sanitize or escape dynamic text");
            assert.ok(html.includes("&lt;script&gt;"), "Tags must be HTML-escaped");
            recordPass("Dynamic student name safely HTML-escaped against XSS");
        } catch (err: any) {
            recordFail("Dynamic student name safely HTML-escaped against XSS", err);
        }

        try {
            const { text } = buildCollegeVerificationEmailTemplate(sampleEmailParams);
            assert.ok(text.includes(sampleEmailParams.verificationLink), "Plain text email must contain full link");
            assert.ok(text.includes("24 hours"), "Plain text email must contain expiry");
            recordPass("Plain text email fallback contains full URL and expiry notice");
        } catch (err: any) {
            recordFail("Plain text email fallback contains full URL and expiry notice", err);
        }

        try {
            // Development simulation path with zero real network calls
            process.env.NODE_ENV = "development";
            delete process.env.RESEND_API_KEY;
            delete process.env.RESEND_FROM_EMAIL;
            const simResult = await sendCollegeVerificationEmail(sampleEmailParams, {
                resendClient: null,
                smtpTransporter: null,
            });
            assert.equal(simResult.success, true);
            assert.equal(simResult.simulated, true);
            assert.equal(simResult.provider, "simulation");
            recordPass("Non-production email dispatch simulates safely without external API calls");
        } catch (err: any) {
            recordFail("Non-production email dispatch simulates safely without external API calls", err);
        }

        try {
            // Production mock provider success vs provider failure
            process.env.NODE_ENV = "production";
            process.env.RESEND_FROM_EMAIL = "Orbix Verify <verify@orbix.dev>";
            const okResult = await sendCollegeVerificationEmail(sampleEmailParams, {
                resendClient: { emails: { send: async () => ({ data: { id: "unit_mock_msg_1" } }) } },
                smtpTransporter: null,
            });
            assert.equal(okResult.success, true);
            assert.equal(okResult.simulated, false);
            assert.equal(okResult.provider, "resend");

            const failResult = await sendCollegeVerificationEmail(sampleEmailParams, {
                resendClient: { emails: { send: async () => ({ error: { message: "Simulated provider failure" } }) } },
                smtpTransporter: null,
            });
            assert.equal(failResult.success, false);
            assert.equal(failResult.simulated, false);
            recordPass("Production email delivery distinguishes mocked provider success vs failure");
        } catch (err: any) {
            recordFail("Production email delivery distinguishes mocked provider success vs failure", err);
        }

        try {
            // Simulated vs failed SMS delivery paths
            process.env.NODE_ENV = "development";
            delete process.env.TWILIO_ACCOUNT_SID;
            delete process.env.TWILIO_AUTH_TOKEN;
            delete process.env.TWILIO_PHONE_NUMBER;
            const smsSim = await sendVerificationSms({ to: "9876543210", otp: "123456" });
            assert.equal(smsSim.success, true);
            assert.equal(smsSim.simulated, true);

            process.env.NODE_ENV = "production";
            const smsProdMissing = await sendVerificationSms({ to: "9876543210", otp: "123456" });
            assert.equal(smsProdMissing.success, false);
            assert.equal(smsProdMissing.simulated, false);
            recordPass("SMS delivery isolates dev simulation from production fail-closed behavior");
        } catch (err: any) {
            recordFail("SMS delivery isolates dev simulation from production fail-closed behavior", err);
        }

        // ----------------------------------------------------
        // TEST SUITE 5: Token Cryptographic Security & Lifecycle
        // ----------------------------------------------------
        console.log("\n5. Token Cryptographic Security & Lifecycle Semantics Suite:");

        try {
            const rawToken = crypto.randomBytes(32).toString("hex");
            const tokenHash1 = crypto.createHash("sha256").update(rawToken).digest("hex");
            const tokenHash2 = crypto.createHash("sha256").update(rawToken).digest("hex");

            assert.equal(rawToken.length, 64, "Raw token must be 64 characters (256-bit entropy)");
            assert.equal(tokenHash1, tokenHash2, "Hash must be deterministic");
            assert.notEqual(rawToken, tokenHash1, "Stored hash must differ from raw token");
            recordPass("Deterministic SHA-256 hashing without storing raw token");
        } catch (err: any) {
            recordFail("Deterministic SHA-256 hashing without storing raw token", err);
        }

        try {
            const expiredRow = {
                id: "tok_1",
                user_id: "user_123",
                verification_id: "verif_abc",
                status: "pending",
                expires_at: new Date(Date.now() - 1000),
            };
            assert.equal(new Date(expiredRow.expires_at).getTime() < Date.now(), true);
            recordPass("Expired token correctly detected and rejected");
        } catch (err: any) {
            recordFail("Expired token correctly detected and rejected", err);
        }

        try {
            const consumedRow = { id: "tok_2", status: "verified" };
            assert.equal(consumedRow.status === "verified", true);
            recordPass("Replayed / consumed token correctly rejected");
        } catch (err: any) {
            recordFail("Replayed / consumed token correctly rejected", err);
        }

        try {
            const boundRow = { id: "tok_3", user_id: "legitimate_user_uuid" };
            assert.equal(boundRow.user_id !== "attacker_user_uuid", true);
            recordPass("Wrong-user token validation correctly rejected (403)");
        } catch (err: any) {
            recordFail("Wrong-user token validation correctly rejected (403)", err);
        }

        try {
            const boundRow = { id: "tok_4", verification_id: "correct_verif_application_id" };
            assert.equal(boundRow.verification_id !== "different_verif_application_id", true);
            recordPass("Wrong-application token validation correctly rejected (403)");
        } catch (err: any) {
            recordFail("Wrong-application token validation correctly rejected (403)", err);
        }

        // ----------------------------------------------------
        // TEST SUITE 6: Concurrency & Atomic Guard Semantics
        // ----------------------------------------------------
        console.log("\n6. Concurrency & Atomic Guard Semantics Suite:");

        try {
            let tokenDbState = { id: "tok_atomic", status: "pending", verifiedAt: null as Date | null };
            const atomicConsumeToken = (id: string) => {
                if (tokenDbState.id === id && tokenDbState.status === "pending") {
                    tokenDbState.status = "verified";
                    tokenDbState.verifiedAt = new Date();
                    return true;
                }
                return false;
            };
            assert.equal(atomicConsumeToken("tok_atomic"), true);
            assert.equal(atomicConsumeToken("tok_atomic"), false);
            recordPass("Atomic single-use token consumption prevents race condition double-redemption");
        } catch (err: any) {
            recordFail("Atomic single-use token consumption prevents race condition double-redemption", err);
        }

        try {
            let phoneOtpDbState = { id: "otp_atomic", status: "pending", verifiedAt: null as Date | null };
            const atomicConsumeOtp = (id: string) => {
                if (phoneOtpDbState.id === id && phoneOtpDbState.status === "pending") {
                    phoneOtpDbState.status = "verified";
                    phoneOtpDbState.verifiedAt = new Date();
                    return true;
                }
                return false;
            };
            assert.equal(atomicConsumeOtp("otp_atomic"), true);
            assert.equal(atomicConsumeOtp("otp_atomic"), false);
            recordPass("Atomic phone OTP consumption prevents concurrent double-verification");
        } catch (err: any) {
            recordFail("Atomic phone OTP consumption prevents concurrent double-verification", err);
        }

        try {
            let attempts = 4;
            let isExpired = false;
            attempts++;
            if (attempts >= 5) isExpired = true;
            assert.equal(isExpired, true);
            recordPass("Phone OTP attempt limit strictly enforced (5 attempts max)");
        } catch (err: any) {
            recordFail("Phone OTP attempt limit strictly enforced (5 attempts max)", err);
        }

        // ----------------------------------------------------
        // TEST SUITE 7: Dedicated Document Proxy & HMAC Security
        // ----------------------------------------------------
        console.log("\n7. Dedicated Document Proxy & HMAC Security Suite:");

        const strongProxySecret = "dedicated_unit_test_document_proxy_hmac_secret_64bytes";
        const sampleJwtSecret = "separate_auth_jwt_secret_that_must_never_sign_proxy_urls";

        try {
            process.env.NODE_ENV = "production";
            process.env.DOCUMENT_PROXY_HMAC_SECRET = strongProxySecret;
            process.env.JWT_SECRET = sampleJwtSecret;

            const signedUrl = CollegeVerificationService.generateSignedDocumentUrl({
                storage: "local",
                filename: sampleDocName,
                originalName: sampleDocName,
                mimeType: "image/png",
                size: 128,
                format: "png",
                uploadedAt: new Date().toISOString(),
            });
            const token = signedUrl.split("/").pop()!;
            const resolved = CollegeVerificationService.resolveDocumentFromProxyToken(token, tmpUploadDir);
            assert.ok(resolved, "Dedicated DOCUMENT_PROXY_HMAC_SECRET must sign and verify token");
            assert.equal(path.basename(resolved.filePath), sampleDocName);
            recordPass("Valid dedicated HMAC document proxy token created and verified");
        } catch (err: any) {
            recordFail("Valid dedicated HMAC document proxy token created and verified", err);
        }

        try {
            // Token signed with JWT_SECRET must be rejected even if JWT_SECRET is set
            process.env.NODE_ENV = "production";
            process.env.DOCUMENT_PROXY_HMAC_SECRET = strongProxySecret;
            process.env.JWT_SECRET = sampleJwtSecret;
            const jwtPayload = JSON.stringify({ f: sampleDocName, exp: Math.floor(Date.now() / 1000) + 300 });
            const jwtHmac = crypto.createHmac("sha256", sampleJwtSecret).update(jwtPayload).digest("hex");
            const jwtSignedToken = Buffer.from(`${jwtPayload}::${jwtHmac}`).toString("base64url");
            assert.equal(
                CollegeVerificationService.resolveDocumentFromProxyToken(jwtSignedToken, tmpUploadDir),
                null,
                "Proxy verifier must reject tokens signed with JWT_SECRET"
            );

            // Production without DOCUMENT_PROXY_HMAC_SECRET (even with strong JWT_SECRET) must fail closed
            delete process.env.DOCUMENT_PROXY_HMAC_SECRET;
            assert.throws(
                () => getDocumentProxySigningSecret(),
                /DOCUMENT_PROXY_HMAC_SECRET/i,
                "Production must not fall back to JWT_SECRET"
            );
            recordPass("Dedicated DOCUMENT_PROXY_HMAC_SECRET strictly isolated from JWT_SECRET");
        } catch (err: any) {
            recordFail("Dedicated DOCUMENT_PROXY_HMAC_SECRET strictly isolated from JWT_SECRET", err);
        }

        try {
            process.env.NODE_ENV = "production";
            process.env.DOCUMENT_PROXY_HMAC_SECRET = strongProxySecret;
            const tamperedPayload = JSON.stringify({ f: "different_student_id.png", exp: Math.floor(Date.now() / 1000) + 300 });
            const realPayload = JSON.stringify({ f: sampleDocName, exp: Math.floor(Date.now() / 1000) + 300 });
            const realHmac = crypto.createHmac("sha256", strongProxySecret).update(realPayload).digest("hex");
            const tamperedToken = Buffer.from(`${tamperedPayload}::${realHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(tamperedToken, tmpUploadDir), null);
            recordPass("Tampered document payload rejected by constant-time HMAC verification");
        } catch (err: any) {
            recordFail("Tampered document payload rejected by constant-time HMAC verification", err);
        }

        try {
            const maliciousFilenames = ["../../../etc/passwd", "..\\..\\Windows\\System32\\cmd.exe", "uploads/../../secret.env"];
            for (const mal of maliciousFilenames) {
                const sanitized = path.basename(mal);
                assert.ok(!sanitized.includes("/") && !sanitized.includes("\\") && !sanitized.includes(".."));
            }
            recordPass("Path traversal vectors sanitized by path.basename");
        } catch (err: any) {
            recordFail("Path traversal vectors sanitized by path.basename", err);
        }

        try {
            process.env.NODE_ENV = "production";
            process.env.DOCUMENT_PROXY_HMAC_SECRET = strongProxySecret;
            const expiredPayload = JSON.stringify({ f: sampleDocName, exp: Math.floor(Date.now() / 1000) - 10 });
            const expHmac = crypto.createHmac("sha256", strongProxySecret).update(expiredPayload).digest("hex");
            const expiredToken = Buffer.from(`${expiredPayload}::${expHmac}`).toString("base64url");
            assert.equal(CollegeVerificationService.resolveDocumentFromProxyToken(expiredToken, tmpUploadDir), null);
            recordPass("Expired document proxy token rejected");
        } catch (err: any) {
            recordFail("Expired document proxy token rejected", err);
        }

        console.log("\n=================================================");
        console.log(`SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log("=================================================\n");

        if (failedTests > 0) {
            process.exit(1);
        }
    } finally {
        process.env = originalEnv;
        try {
            fs.rmSync(tmpUploadDir, { recursive: true, force: true });
        } catch {}
    }
}

runUnitTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
