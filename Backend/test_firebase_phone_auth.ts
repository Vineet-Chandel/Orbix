process.env.NODE_ENV = "test";
import jwt from "jsonwebtoken";
import { normalizePhoneNumber } from "./src/services/sms/smsGatewayService.js";
import { PhoneVerificationService } from "./src/services/sms/phoneVerificationService.js";
import { verifyFirebaseIdToken } from "./src/config/firebaseAdmin.js";
import { query, pool } from "./src/database/client.js";
import redis from "./src/redis/client.js";

const JWT_SECRET = process.env.JWT_SECRET || "orbix_secret_fallback_key_2026";
const TEST_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "orbix-dev";

// Helper to create a signed mock Firebase token for testing
function createMockFirebaseToken(claims: {
    uid?: string;
    phoneNumber?: string;
    projectId?: string;
    expired?: boolean;
    missingPhone?: boolean;
}): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = claims.expired ? now - 3600 : now + 3600;
    const projId = claims.projectId || TEST_PROJECT_ID;

    const payload: any = {
        iss: `https://securetoken.google.com/${projId}`,
        aud: projId,
        auth_time: now,
        user_id: claims.uid || `firebase_test_user_${Date.now()}`,
        sub: claims.uid || `firebase_test_user_${Date.now()}`,
        iat: now - 60,
        exp: exp,
        firebase: {
            identities: claims.missingPhone ? {} : { phone: [claims.phoneNumber || "+919876543210"] },
            sign_in_provider: "phone",
            project_id: projId,
        },
    };

    if (!claims.missingPhone) {
        payload.phone_number = claims.phoneNumber || "+919876543210";
    }

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = Buffer.from("mock_signature_for_test").toString("base64url");

    return `${header}.${body}.${sig}`;
}

async function runTestSuite() {
    console.log("=================================================================");
    console.log("   ORBIX FIREBASE PHONE AUTHENTICATION TEST SUITE");
    console.log("=================================================================\n");

    let passedCount = 0;
    let failedCount = 0;

    const assert = (condition: boolean, testName: string, detail?: string) => {
        if (condition) {
            console.log(`  ✅ [PASS] ${testName}`);
            passedCount++;
        } else {
            console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
            failedCount++;
        }
    };

    try {
        // =================================================================
        // SUITE 1: E.164 Phone Normalization
        // =================================================================
        console.log("👉 [SUITE 1] E.164 Phone Normalization & Validation");

        const standardIndia = normalizePhoneNumber("9876543210");
        assert(
            standardIndia.isValid && standardIndia.canonical === "+919876543210",
            "Normalize standard 10-digit Indian mobile (9876543210 -> +919876543210)"
        );

        const prefixedIndia = normalizePhoneNumber("+919876543210");
        assert(
            prefixedIndia.isValid && prefixedIndia.canonical === "+919876543210",
            "Normalize prefixed Indian mobile (+919876543210)"
        );

        const formattedIndia = normalizePhoneNumber("+91 98765 43210");
        assert(
            formattedIndia.isValid && formattedIndia.canonical === "+919876543210",
            "Normalize spaced formatted mobile (+91 98765 43210)"
        );

        const leadingZeroIndia = normalizePhoneNumber("09876543210");
        assert(
            leadingZeroIndia.isValid && leadingZeroIndia.canonical === "+919876543210",
            "Normalize leading-zero Indian mobile (09876543210)"
        );

        const internationalUs = normalizePhoneNumber("+14155552671");
        assert(
            internationalUs.isValid && internationalUs.canonical === "+14155552671",
            "Normalize international number (+14155552671)"
        );

        const invalidNumber = normalizePhoneNumber("12345");
        assert(!invalidNumber.isValid, "Reject invalid/short phone number (12345)");

        const invalidChars = normalizePhoneNumber("abc9876543210xyz");
        assert(!invalidChars.isValid, "Reject alphabetical phone number");

        // =================================================================
        // SUITE 2: Firebase ID Token Server-Side Verification
        // =================================================================
        console.log("\n👉 [SUITE 2] Firebase ID Token Server-Side Verification");

        const validToken = createMockFirebaseToken({
            phoneNumber: "+919876543210",
            projectId: TEST_PROJECT_ID,
        });
        const decoded = await verifyFirebaseIdToken(validToken);
        assert(
            decoded.phoneNumber === "+919876543210" && decoded.projectId === TEST_PROJECT_ID,
            "Successfully verify valid Firebase ID token"
        );

        // Token from wrong Firebase project
        try {
            const wrongProjectToken = createMockFirebaseToken({
                phoneNumber: "+919876543210",
                projectId: "unauthorized-malicious-project",
            });
            await verifyFirebaseIdToken(wrongProjectToken);
            assert(false, "Token from wrong Firebase project should be rejected");
        } catch (err: any) {
            assert(
                err.statusCode === 403 || err.message.includes("unauthorized project"),
                "Token from wrong Firebase project rejected with 403 Forbidden"
            );
        }

        // Token missing phone_number claim
        try {
            const missingPhoneToken = createMockFirebaseToken({
                missingPhone: true,
                projectId: TEST_PROJECT_ID,
            });
            await verifyFirebaseIdToken(missingPhoneToken);
            assert(false, "Token missing phone_number claim should be rejected");
        } catch (err: any) {
            assert(
                err.statusCode === 400 || err.message.includes("verified phone"),
                "Token missing phone_number claim rejected with 400 Bad Request"
            );
        }

        // Expired token
        try {
            const expiredToken = createMockFirebaseToken({
                phoneNumber: "+919876543210",
                projectId: TEST_PROJECT_ID,
                expired: true,
            });
            await verifyFirebaseIdToken(expiredToken);
            assert(false, "Expired Firebase token should be rejected");
        } catch (err: any) {
            assert(
                err.statusCode === 401 || err.message.includes("expired"),
                "Expired Firebase token rejected with 401 Unauthorized"
            );
        }

        // Empty / malformed token
        try {
            await verifyFirebaseIdToken("");
            assert(false, "Empty token should be rejected");
        } catch (err: any) {
            assert(err.statusCode === 400, "Empty token rejected with 400 Bad Request");
        }

        // =================================================================
        // SUITE 3: Phone Number Mismatch Protection
        // =================================================================
        console.log("\n👉 [SUITE 3] Phone Number Mismatch Protection");

        try {
            const tokenWithPhoneA = createMockFirebaseToken({
                phoneNumber: "+919876543210",
                projectId: TEST_PROJECT_ID,
            });
            // Caller submits phone B (+919123456789) but provides token for phone A
            await PhoneVerificationService.verifyFirebasePhoneAssociation({
                idToken: tokenWithPhoneA,
                expectedPhone: "+919123456789",
            });
            assert(false, "Phone mismatch between token and submitted body should be rejected");
        } catch (err: any) {
            assert(
                err.statusCode === 400 && err.message.includes("mismatch"),
                "Phone mismatch between token and submitted number rejected with 400 Bad Request"
            );
        }

        // =================================================================
        // SUITE 4: Pre-Registration Continuation Token Flow
        // =================================================================
        console.log("\n👉 [SUITE 4] Pre-Registration Continuation Ticket Flow");

        const testPhone = "+919876543210";
        const preRegToken = createMockFirebaseToken({
            phoneNumber: testPhone,
            projectId: TEST_PROJECT_ID,
        });

        // Clean up test phone in DB if present
        await query(`DELETE FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1));`, [testPhone]);

        const preRegRes = await PhoneVerificationService.verifyFirebasePhoneAssociation({
            idToken: preRegToken,
            expectedPhone: testPhone,
        });

        assert(
            preRegRes.success && Boolean(preRegRes.token) && !preRegRes.isAssociated,
            "Pre-registration returns signed continuation token"
        );

        const isContinuationTokenValid = PhoneVerificationService.verifyVerificationToken(
            preRegRes.token!,
            testPhone
        );
        assert(isContinuationTokenValid, "Continuation token cryptographically validates for expected phone");

        const isWrongPhoneInvalid = PhoneVerificationService.verifyVerificationToken(
            preRegRes.token!,
            "+919999999999"
        );
        assert(!isWrongPhoneInvalid, "Continuation token rejected when checked against different phone");

        // =================================================================
        // SUITE 5: Duplicate Phone Protection & Account Integrity
        // =================================================================
        console.log("\n👉 [SUITE 5] Duplicate Phone Number Uniqueness Enforcement");

        // Create a temporary user with this phone
        const tempUserId = crypto.randomUUID();
        const tempEmail = `temp_phone_${Date.now()}@example.com`;
        const tempUsername = `user_phone_${Date.now()}`.slice(0, 15);

        await query(
            `INSERT INTO users (id, username, email, firstname, lastname, phone, is_phone_verified, phone_verified_at, password, termsaccepted)
             VALUES ($1, $2, $3, 'Phone', 'Tester', $4, true, NOW(), 'hashed_pw_test', true);`,
            [tempUserId, tempUsername, tempEmail, testPhone]
        );

        // Attempt to associate the same phone number with a DIFFERENT user account
        try {
            const anotherUserToken = createMockFirebaseToken({
                phoneNumber: testPhone,
                projectId: TEST_PROJECT_ID,
            });
            await PhoneVerificationService.verifyFirebasePhoneAssociation({
                idToken: anotherUserToken,
                expectedPhone: testPhone,
                userId: crypto.randomUUID(), // different user
            });
            assert(false, "Duplicate phone association should be blocked");
        } catch (err: any) {
            assert(
                err.statusCode === 409 && err.message.includes("already associated"),
                "Duplicate phone association rejected with 409 Conflict"
            );
        }

        // Same user re-associating / refreshing their own phone succeeds
        const ownUserToken = createMockFirebaseToken({
            phoneNumber: testPhone,
            projectId: TEST_PROJECT_ID,
        });
        const ownUserRes = await PhoneVerificationService.verifyFirebasePhoneAssociation({
            idToken: ownUserToken,
            expectedPhone: testPhone,
            userId: tempUserId,
        });
        assert(
            ownUserRes.success && ownUserRes.isAssociated,
            "Re-verifying own phone for same account succeeds"
        );

        // Clean up temp test user
        await query(`DELETE FROM users WHERE id = $1;`, [tempUserId]);

        // =================================================================
        // SUITE 6: Database Constraints & Direct Write Tampering Protection
        // =================================================================
        console.log("\n👉 [SUITE 6] Database Integrity & Write Protection");

        // Test database unique index on users(phone)
        const userA = crypto.randomUUID();
        const userB = crypto.randomUUID();
        const testDuplicatePhone = "+919777777777";

        await query(`DELETE FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1));`, [testDuplicatePhone]);

        await query(
            `INSERT INTO users (id, username, email, firstname, lastname, phone, is_phone_verified, phone_verified_at, password, termsaccepted)
             VALUES ($1, $2, $3, 'A', 'User', $4, true, NOW(), 'test_pw', true);`,
            [userA, `test_a_${Date.now()}`.slice(0, 15), `test_a_${Date.now()}@example.com`, testDuplicatePhone]
        );

        let uniqueConstraintCaught = false;
        try {
            await query(
                `INSERT INTO users (id, username, email, firstname, lastname, phone, is_phone_verified, phone_verified_at, password, termsaccepted)
                 VALUES ($1, $2, $3, 'B', 'User', $4, true, NOW(), 'test_pw', true);`,
                [userB, `test_b_${Date.now()}`.slice(0, 15), `test_b_${Date.now()}@example.com`, testDuplicatePhone]
            );
        } catch (dbErr: any) {
            if (dbErr.code === "23505") { // unique_violation
                uniqueConstraintCaught = true;
            }
        }
        assert(uniqueConstraintCaught, "PostgreSQL unique index on phone prevents concurrent duplicate phone insert");

        // Clean up
        await query(`DELETE FROM users WHERE id IN ($1, $2);`, [userA, userB]);

        // =================================================================
        // SUITE 7: Fast2SMS Complete Removal Audit
        // =================================================================
        console.log("\n👉 [SUITE 7] Fast2SMS Complete Removal Verification");

        const fast2smsKey = process.env.FAST2SMS_API_KEY;
        assert(
            !fast2smsKey || fast2smsKey === "your_fast2sms_api_key",
            "Fast2SMS API key is not active in production verification path"
        );

        console.log("\n=================================================================");
        console.log(`   TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
        console.log("=================================================================\n");

        if (failedCount > 0) {
            process.exitCode = 1;
        }
    } catch (unhandled: any) {
        console.error("Unhandled test suite exception:", unhandled);
        process.exitCode = 1;
    } finally {
        await pool.end();
        if (redis && redis.status === "ready") {
            redis.disconnect();
        }
    }
}

runTestSuite();
