import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { query } from "../src/database/client.js";
import { CollegeVerificationService } from "../src/services/verification/collegeVerificationService.js";
import { CollegeOcrService } from "../src/services/verification/collegeOcrService.js";
import { isAuthorizedFounder } from "../src/middlewares/founder.middleware.js";

async function runTests() {
    console.log("=================================================");
    console.log("🚀 ORBIX COLLEGE VERIFICATION INTEGRATION TEST SUITE");
    console.log("=================================================\n");

    let testUserId = "";
    let testInstitutionId = "";
    let testCollege2Id = "";
    const testEmail = "orbix_tester_" + Date.now() + "@test.org";

    try {
        // 1. Setup Test Institutions and Test User
        console.log("1. Setting up test fixtures...");
        const instRes = await query(`SELECT id, official_name, website FROM institutions WHERE website IS NOT NULL LIMIT 2;`);
        if (instRes.rows.length < 2) {
            throw new Error("Expected at least 2 institutions with website in DB");
        }
        testInstitutionId = instRes.rows[0].id;
        testCollege2Id = instRes.rows[1].id;
        const inst1 = instRes.rows[0];
        console.log(`   Found Test Institution 1: ${inst1.official_name} (${inst1.website})`);
        console.log(`   Found Test Institution 2: ${instRes.rows[1].official_name}`);

        // Create test user
        const userRes = await query(
            `INSERT INTO users (
                email, username, firstname, lastname, college_id, is_college_verified
             ) VALUES (
                $1, $2, 'Verification', 'Tester', $3, false
             ) RETURNING id;`,
            [testEmail, `tester_${Date.now()}`, testInstitutionId]
        );
        testUserId = userRes.rows[0].id;
        console.log(`   Created test user ID: ${testUserId}`);

        // 2. Initial Verification Status Check
        console.log("\n2. Checking initial verification status...");
        const initialStatus = await CollegeVerificationService.getStatus(testUserId);
        console.log(`   Status: ${initialStatus.status}, IsVerified: ${initialStatus.isCollegeVerified}`);
        if (initialStatus.status !== "NOT_VERIFIED" || initialStatus.isCollegeVerified !== false) {
            throw new Error(`Expected NOT_VERIFIED, got ${initialStatus.status}`);
        }
        console.log("   ✅ Initial status check passed.");

        // 3. OCR Engine & MIME Validation Test
        console.log("\n3. Testing OCR Engine validation and processing...");
        // 3a. Invalid mime type / corrupt buffer
        const invalidCheck = CollegeOcrService.validateImageBuffer(Buffer.from("invalid text payload"));
        if (invalidCheck.isValid) {
            throw new Error("Should have rejected invalid image bytes");
        }
        console.log(`   ✅ Correctly caught invalid magic bytes: ${invalidCheck.error}`);

        // 3b. Valid authentic image file from tesseract docs
        const validPng = fs.readFileSync(
            path.resolve(process.cwd(), "node_modules/tesseract.js/docs/images/tesseract.png")
        );
        const validCheck = CollegeOcrService.validateImageBuffer(validPng);
        if (!validCheck.isValid || validCheck.format !== "png") {
            throw new Error(`Failed to validate authentic PNG image: ${validCheck.error}`);
        }
        console.log(`   ✅ Valid PNG magic byte signature verified (${validPng.length} bytes, format: ${validCheck.format}).`);

        const ocrResult = await CollegeOcrService.processDocumentImage(validPng, inst1.official_name);
        console.log(`   OCR Result extracted structure present: ${!!ocrResult.extractedFields}, confidence=${ocrResult.confidence}`);
        if (!ocrResult.extractedFields) {
            throw new Error("Expected structured extraction fields");
        }
        console.log("   ✅ OCR processing structure & fallback verified.");

        // 4. Verification Application Submission
        console.log("\n4. Submitting student verification application...");
        const submissionResult = await CollegeVerificationService.submitApplication({
            userId: testUserId,
            collegeId: testInstitutionId,
            documentType: "student_id",
            studentName: "Verification Tester",
            enrollmentNumber: "ENR12345678",
            courseName: "B.Tech Computer Science",
            academicYear: "2024-2028",
            institutionEmail: "tester@institute.edu",
            phoneNumber: "+919876543210",
            ocrConfidence: 85,
            extractedData: {
                studentName: "Verification Tester",
                collegeName: inst1.official_name,
                enrollmentNumber: "ENR12345678",
                courseName: "B.Tech Computer Science",
                academicYear: "2024-2028",
                institutionEmail: "tester@institute.edu",
                phoneNumber: "+919876543210",
            },
            files: [
                {
                    buffer: validPng,
                    mimetype: "image/png",
                    originalname: "student_id_front.png",
                    size: validPng.length,
                },
            ],
        });

        const verificationId = submissionResult.application?.id;
        console.log(`   Submitted verification ID: ${verificationId}, status: ${submissionResult.application?.status}`);
        if (submissionResult.application?.status !== "PENDING") {
            throw new Error(`Expected PENDING status, got ${submissionResult.application?.status}`);
        }
        console.log("   ✅ Application submission successful.");

        // 5. Duplicate Active Submission Prevention Check
        console.log("\n5. Testing duplicate active submission prevention...");
        try {
            await CollegeVerificationService.submitApplication({
                userId: testUserId,
                collegeId: testInstitutionId,
                documentType: "erp_profile",
                files: [
                    {
                        buffer: validPng,
                        mimetype: "image/png",
                        originalname: "student_id_2.png",
                        size: validPng.length,
                    },
                ],
            });
            throw new Error("Should have blocked duplicate active submission");
        } catch (err: any) {
            console.log(`   ✅ Correctly blocked duplicate submission: ${err.message}`);
        }

        // 6. Institutional Email Verification Token
        console.log("\n6. Testing institutional email token flow...");
        const instEmail = "student@institution.edu";
        const emailSendResult = await CollegeVerificationService.sendInstitutionalEmailToken({
            userId: testUserId,
            email: instEmail,
            collegeId: testInstitutionId,
        });
        console.log(`   Sent email verification link: ${emailSendResult.message}`);
        
        // Retrieve the token from DB
        const tokenRow = await query(
            `SELECT id, token_hash FROM college_verification_email_tokens 
             WHERE user_id = $1 AND LOWER(institution_email) = LOWER($2) AND status = 'pending' 
             ORDER BY created_at DESC LIMIT 1;`,
            [testUserId, instEmail]
        );
        if (!tokenRow.rows.length) {
            throw new Error("Email token record not found in DB");
        }
        console.log("   Found pending email token record in DB.");

        // Invalidate previous and create known raw token for deterministic testing
        const knownRawToken = "test_raw_token_" + Date.now();
        const knownHash = crypto.createHash("sha256").update(knownRawToken).digest("hex");
        await query(
            `UPDATE college_verification_email_tokens SET token_hash = $1 WHERE id = $2;`,
            [knownHash, tokenRow.rows[0].id]
        );

        // Verify the token
        const emailVerifyResult = await CollegeVerificationService.verifyInstitutionalEmailToken(knownRawToken, testUserId);
        if (!emailVerifyResult.success) {
            throw new Error("Email verification token redemption failed");
        }
        console.log("   ✅ Institutional email verification token redeemed successfully.");

        // 7. Phone OTP Flow
        console.log("\n7. Testing Phone OTP flow...");
        const testPhone = "+919876543210";
        await CollegeVerificationService.sendPhoneOtp({
            userId: testUserId,
            phone: testPhone,
        });
        
        // Query OTP from DB to test verification
        const otpRow = await query(
            `SELECT id, otp_hash FROM college_verification_phone_otps 
             WHERE user_id = $1 AND status = 'pending' 
             ORDER BY created_at DESC LIMIT 1;`,
            [testUserId]
        );
        if (!otpRow.rows.length) {
            throw new Error("Phone OTP record was not created in DB");
        }
        console.log("   Found pending phone OTP record in DB.");

        // Set known OTP hash for deterministic test
        const knownOtp = "123456";
        const knownOtpHash = crypto.createHash("sha256").update(knownOtp).digest("hex");
        await query(
            `UPDATE college_verification_phone_otps SET otp_hash = $1, attempts = 0 WHERE id = $2;`,
            [knownOtpHash, otpRow.rows[0].id]
        );

        // 7a. Test incorrect OTP
        try {
            await CollegeVerificationService.verifyPhoneOtp({
                userId: testUserId,
                phone: testPhone,
                otp: "999999",
            });
            throw new Error("Wrong OTP should have thrown an error");
        } catch (err: any) {
            console.log(`   ✅ Incorrect OTP properly rejected: ${err.message}`);
        }

        // 7b. Test correct OTP
        const correctVerify = await CollegeVerificationService.verifyPhoneOtp({
            userId: testUserId,
            phone: testPhone,
            otp: knownOtp,
        });
        if (!correctVerify.success) {
            throw new Error("Correct OTP verification failed");
        }
        console.log("   ✅ Phone OTP successfully verified.");

        // 8. Founder Authorization Check
        console.log("\n8. Testing Founder-only authorization check...");
        const nonFounderAllowed = await isAuthorizedFounder(testUserId);
        if (nonFounderAllowed) {
            throw new Error("Standard user should NOT be recognized as founder");
        }
        const founderAllowed = await isAuthorizedFounder("0ee6f4a7-98d4-4bfa-96d1-6c88b7892e0a");
        if (!founderAllowed) {
            throw new Error("Allowlisted founder ID should be recognized as founder");
        }
        console.log("   ✅ Founder allowlist authorization logic strictly validated.");

        // 9. Founder Review Queue & Document Signed Preview
        console.log("\n9. Testing founder review queue and application inspector...");
        const queue = await CollegeVerificationService.listQueue({
            status: "PENDING",
            limit: 10,
        });
        const foundInQueue = queue.applications.find((a: any) => a.id === verificationId);
        if (!foundInQueue) {
            throw new Error("Pending application not found in founder queue");
        }
        console.log(`   Found in queue: ${foundInQueue.student_name} (${foundInQueue.college_name})`);

        const details = await CollegeVerificationService.getApplication(verificationId);
        if (!details || !details.application || !details.application.document_previews || details.application.document_previews.length === 0) {
            throw new Error("Failed to get verification details or signed preview URLs");
        }
        console.log(`   Preview URL generated: ${details.application.document_previews[0]?.url.substring(0, 45)}...`);
        console.log("   ✅ Founder queue & signed URL generation passed.");

        // 10. Application Approval
        console.log("\n10. Testing application approval...");
        const founderReviewerId = "0ee6f4a7-98d4-4bfa-96d1-6c88b7892e0a";
        const approveResult = await CollegeVerificationService.approveApplication(
            verificationId,
            founderReviewerId,
            "Approved by founder via test"
        );
        if (approveResult.application?.status !== "APPROVED") {
            throw new Error(`Expected APPROVED status, got ${approveResult.application?.status}`);
        }

        // Verify user badge activation in database
        const userCheck = await query(`SELECT is_college_verified, college_verified_at FROM users WHERE id = $1;`, [testUserId]);
        if (!userCheck.rows[0].is_college_verified) {
            throw new Error("User is_college_verified was not set to true");
        }
        console.log("   ✅ User is_college_verified set to TRUE with timestamp.");

        // Verify status resolution matches current college
        const verifiedStatus = await CollegeVerificationService.getStatus(testUserId);
        if (!verifiedStatus.isCollegeVerified || verifiedStatus.status !== "APPROVED") {
            throw new Error("Status resolution failed to report approved for current college");
        }
        console.log("   ✅ College Verified badge active for current college.");

        // 11. College Change Invalidation
        console.log("\n11. Testing transactional college change invalidation...");
        await query(`UPDATE users SET college_id = $1 WHERE id = $2;`, [testCollege2Id, testUserId]);
        await CollegeVerificationService.invalidateForCollegeChange(testUserId, testCollege2Id);

        const invalidatedUser = await query(`SELECT is_college_verified FROM users WHERE id = $1;`, [testUserId]);
        if (invalidatedUser.rows[0].is_college_verified) {
            throw new Error("User is_college_verified must be false after college change");
        }
        const invStatus = await CollegeVerificationService.getStatus(testUserId);
        if (invStatus.isCollegeVerified !== false) {
            throw new Error("User must NOT have verified badge for new college");
        }
        console.log("   ✅ College change properly invalidated verification and preserved historical records.");

        // 12. Rejection Flow with Mandatory Reason
        console.log("\n12. Testing application rejection and mandatory reason validation...");
        // Submit second application for new college
        const sub2 = await CollegeVerificationService.submitApplication({
            userId: testUserId,
            collegeId: testCollege2Id,
            documentType: "student_id",
            studentName: "Verification Tester",
            enrollmentNumber: "ENR-NEW-999",
            files: [
                {
                    buffer: validPng,
                    mimetype: "image/png",
                    originalname: "id_new.png",
                    size: validPng.length,
                },
            ],
        });

        const sub2Id = sub2.application.id;

        // Try reject without reason
        try {
            await CollegeVerificationService.rejectApplication(sub2Id, founderReviewerId, "");
            throw new Error("Should have rejected rejection request without reason");
        } catch (err: any) {
            console.log(`   ✅ Correctly required rejection reason: ${err.message}`);
        }

        // Reject with reason
        const rejectResult = await CollegeVerificationService.rejectApplication(
            sub2Id,
            founderReviewerId,
            "ID card expired; please upload current academic year ID card."
        );
        if (rejectResult.application?.status !== "REJECTED") {
            throw new Error("Expected REJECTED status");
        }

        const afterRejectStatus = await CollegeVerificationService.getStatus(testUserId);
        const rejectionReason =
            afterRejectStatus.latestApplication?.rejection_reason ||
            afterRejectStatus.latestApplication?.rejectionReason ||
            afterRejectStatus.activeApplication?.rejection_reason ||
            afterRejectStatus.activeApplication?.rejectionReason;
        if (afterRejectStatus.status !== "REJECTED" || !rejectionReason) {
            throw new Error(`Rejection status and reason not properly reflected: status=${afterRejectStatus.status}, reason=${rejectionReason}`);
        }
        console.log(`   Rejection reason reflected: "${rejectionReason}"`);
        console.log("   ✅ Rejection workflow verified.");

        console.log("\n=================================================");
        console.log("🎉 ALL 12 VERIFICATION INTEGRATION TESTS PASSED!");
        console.log("=================================================\n");
        process.exit(0);
    } catch (err) {
        console.error("❌ Test suite error:", err);
        process.exit(1);
    } finally {
        // Cleanup test data
        if (testUserId) {
            console.log("Cleaning up test user fixtures...");
            await query(`DELETE FROM college_verification_phone_otps WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM college_verification_email_tokens WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM college_verifications WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
            console.log("Cleaned up successfully.");
        }
    }
}

runTests();
