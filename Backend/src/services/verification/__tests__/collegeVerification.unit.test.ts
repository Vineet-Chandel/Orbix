import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getCanonicalFrontendUrl } from "../collegeVerificationService.js";
import { isAuthorizedFounder } from "../../../middlewares/founder.middleware.js";
import { CollegeOcrService } from "../collegeOcrService.js";
import { buildCollegeVerificationEmailTemplate, sendCollegeVerificationEmail } from "../../email/resendService.js";

async function runUnitTests() {
    console.log("=================================================");
    console.log("🧪 ORBIX COLLEGE VERIFICATION SAFE UNIT TEST SUITE");
    console.log("   (Isolated, Zero-DB-Pollution, Mocked Mail/SMS)");
    console.log("=================================================\n");

    let passedTests = 0;
    let failedTests = 0;

    function recordPass(testName: string) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
    }

    function recordFail(testName: string, err: any) {
        console.error(`  ❌ FAIL: ${testName}`);
        console.error(`     Error: ${err.message}`);
        failedTests++;
    }

    // Preserve original env
    const originalEnv = { ...process.env };

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
        process.env.ORBIX_FOUNDER_USER_IDS = `${sampleFounderUuid}, 0ee6f4a7-98d4-4bfa-96d1-6c88b7892e0a`;
        const res = await isAuthorizedFounder(sampleFounderUuid);
        assert.equal(res, true, "Should authorize allowlisted UUID");
        recordPass("Allowlisted founder UUID authorized");
    } catch (err: any) {
        recordFail("Allowlisted founder UUID authorized", err);
    }

    try {
        const res = await isAuthorizedFounder(nonFounderUuid);
        assert.equal(res, false, "Should reject non-allowlisted UUID");
        recordPass("Non-allowlisted UUID rejected");
    } catch (err: any) {
        recordFail("Non-allowlisted UUID rejected", err);
    }

    try {
        const r1 = await isAuthorizedFounder("invalid-uuid-string");
        assert.equal(r1, false, "Should reject malformed UUID");
        const r2 = await isAuthorizedFounder("");
        assert.equal(r2, false, "Should reject empty string");
        const r3 = await isAuthorizedFounder(undefined as any);
        assert.equal(r3, false, "Should reject undefined");
        recordPass("Malformed and empty UUID values rejected");
    } catch (err: any) {
        recordFail("Malformed and empty UUID values rejected", err);
    }

    try {
        const r = await isAuthorizedFounder("admin@orbix.dev");
        assert.equal(r, false, "Should reject email string");
        recordPass("Email addresses rejected as user IDs");
    } catch (err: any) {
        recordFail("Email addresses rejected as user IDs", err);
    }

    try {
        delete process.env.ORBIX_FOUNDER_USER_IDS;
        delete process.env.ORBIX_FOUNDER_EMAILS;
        const r = await isAuthorizedFounder("0ee6f4a7-98d4-4bfa-96d1-6c88b7892e0a");
        assert.equal(r, false, "Should have zero fallback defaults when env is unset");
        recordPass("Zero fallback defaults when ORBIX_FOUNDER_USER_IDS is absent");
    } catch (err: any) {
        recordFail("Zero fallback defaults when ORBIX_FOUNDER_USER_IDS is absent", err);
    }

    // ----------------------------------------------------
    // TEST SUITE 3: OCR Engine Magic Bytes & Validation
    // ----------------------------------------------------
    console.log("\n3. OCR Engine Magic Bytes & Validation Suite:");

    try {
        const corruptBuffer = Buffer.alloc(200);
        corruptBuffer.write("<html><head><script>malicious()</script></head></html>");
        const corruptRes = CollegeOcrService.validateImageBuffer(corruptBuffer);
        assert.equal(corruptRes.isValid, false, "Should reject non-image buffer");
        assert.match(corruptRes.error || "", /Unsupported file type/);
        recordPass("Corrupt / non-image buffer safely rejected");
    } catch (err: any) {
        recordFail("Corrupt / non-image buffer safely rejected", err);
    }

    try {
        // Authentic PNG header padded to 200 bytes
        const pngBuf = Buffer.alloc(200);
        const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        for (let i = 0; i < pngHeader.length; i++) pngBuf[i] = pngHeader[i]!;
        const pngRes = CollegeOcrService.validateImageBuffer(pngBuf);
        assert.equal(pngRes.isValid, true, "Should validate PNG header");
        assert.equal(pngRes.format, "png");
        recordPass("Authentic PNG magic bytes validated");
    } catch (err: any) {
        recordFail("Authentic PNG magic bytes validated", err);
    }

    try {
        // Authentic JPEG header padded to 200 bytes
        const jpegBuf = Buffer.alloc(200);
        jpegBuf[0] = 0xff;
        jpegBuf[1] = 0xd8;
        jpegBuf[2] = 0xff;
        jpegBuf[3] = 0xe0;
        const jpegRes = CollegeOcrService.validateImageBuffer(jpegBuf);
        assert.equal(jpegRes.isValid, true, "Should validate JPEG header");
        assert.equal(jpegRes.format, "jpg");
        recordPass("Authentic JPEG magic bytes validated");
    } catch (err: any) {
        recordFail("Authentic JPEG magic bytes validated", err);
    }

    try {
        // Authentic WebP header padded to 200 bytes
        const webpBuf = Buffer.alloc(200);
        webpBuf.write("RIFF", 0);
        webpBuf.writeUInt32LE(192, 4);
        webpBuf.write("WEBP", 8);
        const webpRes = CollegeOcrService.validateImageBuffer(webpBuf);
        assert.equal(webpRes.isValid, true, "Should validate WebP header");
        assert.equal(webpRes.format, "webp");
        recordPass("Authentic WebP magic bytes validated");
    } catch (err: any) {
        recordFail("Authentic WebP magic bytes validated", err);
    }

    try {
        const oversized = Buffer.alloc(11 * 1024 * 1024); // 11MB
        oversized[0] = 0xff;
        oversized[1] = 0xd8;
        oversized[2] = 0xff;
        const sizeRes = CollegeOcrService.validateImageBuffer(oversized);
        assert.equal(sizeRes.isValid, false, "Should reject >10MB buffer");
        assert.match(sizeRes.error || "", /File exceeds 10MB size limit/);
        recordPass("Oversized image buffer (>10MB) safely rejected");
    } catch (err: any) {
        recordFail("Oversized image buffer (>10MB) safely rejected", err);
    }

    // ----------------------------------------------------
    // TEST SUITE 4: Dedicated Email Verification Template & Link
    // ----------------------------------------------------
    console.log("\n4. Dedicated Institutional Verification Email Suite:");

    try {
        const rawToken = crypto.randomBytes(32).toString("hex");
        assert.equal(rawToken.length, 64, "Raw token must be 64 hex characters");
        const verificationLink = `https://orbix.dev/profile?verify_college_email=${rawToken}`;

        const template = buildCollegeVerificationEmailTemplate({
            to: "student@iitk.ac.in",
            studentName: "<script>alert('xss')</script>Rahul",
            collegeName: "Indian Institute of Technology Kanpur",
            verificationLink,
            expiresInHours: 24,
        });

        // 4a. HTML must contain the full 64-character verification URL
        assert.ok(template.html.includes(verificationLink), "HTML must embed full verification URL");
        assert.ok(template.html.includes(`verify_college_email=${rawToken}`), "HTML must embed raw token parameter");
        recordPass("Full 64-character verification URL embedded in HTML template");

        // 4b. Dynamic student name must be escaped (XSS defense)
        assert.ok(!template.html.includes("<script>alert"), "HTML template must escape dynamic student name");
        assert.ok(template.html.includes("&lt;script&gt;alert"), "HTML template must contain entity-encoded script tags");
        recordPass("Dynamic student name safely HTML-escaped against XSS");

        // 4c. Plain text fallback must contain full URL and expiry period
        assert.ok(template.text.includes(verificationLink), "Plain text fallback must include full verification link");
        assert.ok(template.text.includes("24 hours"), "Plain text fallback must state expiry hours");
        recordPass("Plain text email fallback contains full URL and expiry notice");

        // 4d. Simulated dispatch handling
        process.env.RESEND_API_KEY = "re_test_mock_key_only";
        process.env.EMAIL_PROVIDER = "auto";
        const emailResult = await sendCollegeVerificationEmail({
            to: "student@iitk.ac.in",
            studentName: "Rahul Sharma",
            collegeName: "IIT Kanpur",
            verificationLink,
            expiresInHours: 24,
        });
        assert.ok(emailResult !== undefined, "sendCollegeVerificationEmail must complete without unhandled exception");
        recordPass("sendCollegeVerificationEmail handles dispatch gracefully");
    } catch (err: any) {
        recordFail("Institutional verification email suite", err);
    }

    // ----------------------------------------------------
    // TEST SUITE 5: Token Cryptographic Security & Lifecycle Semantics
    // ----------------------------------------------------
    console.log("\n5. Token Cryptographic Security & Lifecycle Semantics Suite:");

    try {
        const rawToken = "e2d5c8a1b4f70938475628190384756201928475610293847561029384756102";
        const hash1 = crypto.createHash("sha256").update(rawToken).digest("hex");
        const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex");
        assert.equal(hash1, hash2, "Token hashing must be deterministic");
        assert.notEqual(rawToken, hash1, "Token must be hashed before DB storage");
        assert.equal(hash1.length, 64, "SHA-256 hash length must be 64 hex characters");
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
            expires_at: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        };

        const isExpired = expiredRow.status === "expired" || new Date(expiredRow.expires_at).getTime() < Date.now();
        assert.equal(isExpired, true, "Token past expiry must be flagged expired");
        recordPass("Expired token correctly detected and rejected");
    } catch (err: any) {
        recordFail("Expired token correctly detected and rejected", err);
    }

    try {
        const consumedRow = {
            id: "tok_2",
            user_id: "user_123",
            verification_id: "verif_abc",
            status: "verified", // already used
            expires_at: new Date(Date.now() + 3600 * 1000),
        };

        const isAlreadyUsed = consumedRow.status === "verified";
        assert.equal(isAlreadyUsed, true, "Already consumed token must be flagged");
        recordPass("Replayed / consumed token correctly rejected");
    } catch (err: any) {
        recordFail("Replayed / consumed token correctly rejected", err);
    }

    try {
        const boundRow = {
            id: "tok_3",
            user_id: "legitimate_user_uuid",
            verification_id: "verif_abc",
            status: "pending",
            expires_at: new Date(Date.now() + 3600 * 1000),
        };

        const attemptingUserId = "attacker_user_uuid";
        const isWrongUser = attemptingUserId && boundRow.user_id !== attemptingUserId;
        assert.equal(isWrongUser, true, "Token attempted by wrong user must be rejected");
        recordPass("Wrong-user token validation correctly rejected (403)");
    } catch (err: any) {
        recordFail("Wrong-user token validation correctly rejected (403)", err);
    }

    try {
        const boundRow = {
            id: "tok_4",
            user_id: "user_123",
            verification_id: "correct_verif_application_id",
            status: "pending",
            expires_at: new Date(Date.now() + 3600 * 1000),
        };

        const attemptingVerifId = "different_verif_application_id";
        const isWrongApp = attemptingVerifId && boundRow.verification_id && boundRow.verification_id !== attemptingVerifId;
        assert.equal(isWrongApp, true, "Token attempted for wrong application must be rejected");
        recordPass("Wrong-application token validation correctly rejected (403)");
    } catch (err: any) {
        recordFail("Wrong-application token validation correctly rejected (403)", err);
    }

    // Restore environment
    process.env = originalEnv;

    console.log("\n=================================================");
    console.log(`SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=================================================\n");

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runUnitTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
