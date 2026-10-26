import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { pool, query } from "./src/database/client.js";
import redis from "./src/redis/client.js";
import clubRouter, { getReviewerAllowlist } from "./src/Routes/club/club.js";
import profileRouter from "./src/Routes/profile/profile.js";
import ClubRegistrationValidator from "./src/validators/ClubRegistrationValidator.js";
import { ValidationError } from "./src/validators/SignupValidator.js";

const TEST_EMAIL = "pipeline_test_club@orbix.test";
const TEST_USERNAME = "pipelinetestclub";
const REVIEWER_EMAIL = "staff@orbix.dev"; // In allowlist

let server: any;
let baseUrl: string;

function assert(condition: any, message: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`  ✓ ${message}`);
}

async function run() {
    console.log("\n========================================================");
    console.log("🚀 ORBIX CLUB REGISTRATION & VERIFICATION PIPELINE TESTS");
    console.log("========================================================\n");

    // -------------------------------------------------------------------------
    // UNIT TESTS: ClubRegistrationValidator
    // -------------------------------------------------------------------------
    console.log("--- UNIT TESTS: Input & Security Validator ---");

    const validPayload = {
        clubName: "Orbix Developers Club",
        collegeName: "Indian Institute of Technology, Bombay",
        collegeCountry: "India",
        collegeState: "Maharashtra",
        collegeCity: "Mumbai",
        clubCategory: "Coding and Competitive Programming",
        clubDescription: "Student developer chapter focusing on open source and systems.",
        contactPersonName: "Aarav Sharma",
        contactPersonRole: "President",
        contactEmail: TEST_EMAIL,
        collegeOfficialEmail: "aarav@iitb.ac.in",
        contactPhone: "+91 98765 43210",
        collegeWebsiteUrl: "https://www.iitb.ac.in",
        clubWebsiteUrl: "https://orbix.iitb.ac.in",
        clubSocialUrl: "https://github.com/orbix-iitb",
        username: TEST_USERNAME,
        password: "StrongPassword!2026",
        confirmPassword: "StrongPassword!2026",
        termsAccepted: true,
        privacyPolicyAccepted: true,
    };

    // Test 1: Valid payload passes validation
    try {
        const validated = ClubRegistrationValidator(validPayload);
        assert(validated.clubName === "Orbix Developers Club", "Valid payload passed validation cleanly");
        assert(validated.contactEmail === TEST_EMAIL.toLowerCase(), "Email normalized to lowercase");
    } catch (e: any) {
        assert(false, `Valid payload should not fail: ${e.message}`);
    }

    // Test 2: Reject empty or whitespace-only club name
    try {
        ClubRegistrationValidator({ ...validPayload, clubName: "   " });
        assert(false, "Should reject whitespace club name");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected whitespace club name with ValidationError");
    }

    // Test 3: Reject missing institution
    try {
        ClubRegistrationValidator({ ...validPayload, collegeName: "" });
        assert(false, "Should reject empty college name");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected empty college name");
    }

    // Test 4: Reject weak password (< 8 chars or no numbers/special)
    try {
        ClubRegistrationValidator({ ...validPayload, password: "weak", confirmPassword: "weak" });
        assert(false, "Should reject weak password");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected weak password under minimum strength standard");
    }

    // Test 5: Reject password confirmation mismatch
    try {
        ClubRegistrationValidator({ ...validPayload, confirmPassword: "DifferentPassword!2026" });
        assert(false, "Should reject mismatched password confirmation");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected mismatched password confirmation");
    }

    // Test 6: Reject unaccepted terms / privacy
    try {
        ClubRegistrationValidator({ ...validPayload, termsAccepted: false });
        assert(false, "Should reject unaccepted terms");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected unaccepted terms");
    }

    try {
        ClubRegistrationValidator({ ...validPayload, privacyPolicyAccepted: false });
        assert(false, "Should reject unaccepted privacy policy");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected unaccepted privacy policy");
    }

    // Test 7: Reject invalid URL format in verification references
    try {
        ClubRegistrationValidator({ ...validPayload, collegeWebsiteUrl: "not-a-valid-url" });
        assert(false, "Should reject invalid college website URL");
    } catch (e: any) {
        assert(e instanceof ValidationError, "Rejected invalid URL format");
    }

    // -------------------------------------------------------------------------
    // SETUP TEST HTTP SERVER
    // -------------------------------------------------------------------------
    console.log("\n--- SETTING UP INTEGRATION TEST HTTP SERVER ---");
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/club", clubRouter);
    app.use("/api/profile", profileRouter);

    await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`  ✓ Test Express server listening on ${baseUrl}`);
            resolve();
        });
    });

    // Cleanup previous test state if exists
    const rateLimitKeys = await redis.keys("auth:signup:fail:*");
    if (rateLimitKeys.length > 0) {
        await redis.del(...rateLimitKeys);
    }
    await query("DELETE FROM club_verification_requests WHERE LOWER(contact_email) = LOWER($1);", [TEST_EMAIL]);
    await query("DELETE FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2);", [TEST_EMAIL, TEST_USERNAME]);
    await query("DELETE FROM auth.users WHERE LOWER(email) = LOWER($1);", [TEST_EMAIL]).catch(() => {});

    let applicantToken = "";
    let applicantUserId = "";
    let verificationRequestId = "";

    // -------------------------------------------------------------------------
    // TEST 8: Register Club Account (POST /api/club/register)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Club Registration Endpoint ---");

    const regResponse = await fetch(`${baseUrl}/api/club/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
    });

    assert(regResponse.status === 201, `POST /api/club/register returned 201 Created (got ${regResponse.status})`);
    const regData: any = await regResponse.json();
    assert(regData.success === true, "Response success flag is true");
    assert(typeof regData.token === "string" && regData.token.length > 20, "Returned valid JWT session token");
    assert(regData.user.accountType === "club", "User accountType is 'club'");
    assert(regData.request.status === "pending", "Verification request initialized with status 'pending'");

    applicantToken = regData.token;
    applicantUserId = regData.user.id;
    verificationRequestId = regData.request.id;

    // Verify Database state
    const userDbRes = await query("SELECT id, username, email, account_type FROM users WHERE id = $1;", [applicantUserId]);
    assert(userDbRes.rows.length === 1, "User record found in public.users");
    assert(userDbRes.rows[0].account_type === "club", "public.users.account_type is 'club'");

    const reqDbRes = await query("SELECT id, club_name, status, terms_accepted, privacy_policy_accepted FROM club_verification_requests WHERE id = $1;", [verificationRequestId]);
    assert(reqDbRes.rows.length === 1, "Request record found in public.club_verification_requests");
    assert(reqDbRes.rows[0].status === "pending", "club_verification_requests.status is 'pending'");
    assert(reqDbRes.rows[0].terms_accepted === true, "Terms acceptance recorded in database");
    assert(reqDbRes.rows[0].privacy_policy_accepted === true, "Privacy policy acceptance recorded in database");

    // -------------------------------------------------------------------------
    // TEST 9: Duplicate Registration Prevention (409 Conflict)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Duplicate Registration Guard ---");

    const dupResponse = await fetch(`${baseUrl}/api/club/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
    });

    assert(dupResponse.status === 409, `Duplicate registration rejected with 409 Conflict (got ${dupResponse.status})`);

    // -------------------------------------------------------------------------
    // TEST 10: Applicant Status Tracking & Confidentiality Check
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Applicant Status Tracking & Zero-Leakage ---");

    const statusResponse = await fetch(`${baseUrl}/api/club/application-status`, {
        headers: {
            Authorization: `Bearer ${applicantToken}`,
            Cookie: `token=${applicantToken}`,
        },
    });

    assert(statusResponse.status === 200, `GET /api/club/application-status returned 200 OK (got ${statusResponse.status})`);
    const statusData: any = await statusResponse.json();
    assert(statusData.success === true, "Status query returned success: true");
    assert(statusData.application.club_name === "Orbix Developers Club", "Returned correct club name to applicant");
    assert(statusData.application.status === "pending", "Returned current application status 'pending'");

    // CRITICAL SECURITY ASSERTION: Internal reviewer notes and checklist must NEVER be returned to the applicant
    assert(statusData.application.internal_notes === undefined, "CONFIDENTIALITY: internal_notes NOT exposed to applicant");
    assert(statusData.application.college_contact_status === undefined, "CONFIDENTIALITY: college_contact_status NOT exposed to applicant");
    assert(statusData.application.reviewed_by === undefined, "CONFIDENTIALITY: reviewed_by NOT exposed to applicant");
    assert(statusData.application.club_existence_confirmed === undefined, "CONFIDENTIALITY: checklist NOT exposed to applicant");

    // -------------------------------------------------------------------------
    // TEST 11: Personal Feature Route Guard for Club Accounts
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Personal Profile Restrictions for Club Accounts ---");

    const profileUpdateRes = await fetch(`${baseUrl}/api/profile`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${applicantToken}`,
            Cookie: `token=${applicantToken}`,
        },
        body: JSON.stringify({ headline: "Trying to edit personal profile as a club" }),
    });

    assert(profileUpdateRes.status === 403, `Club account barred from personal profile update with 403 Forbidden (got ${profileUpdateRes.status})`);

    // -------------------------------------------------------------------------
    // TEST 12: Reviewer Authorization Access Control
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Reviewer Authorization & Queue Access Control ---");

    // 12a: Club applicant attempting reviewer queue -> 403 Forbidden
    const applicantQueueRes = await fetch(`${baseUrl}/api/club/reviewer/queue`, {
        headers: {
            Authorization: `Bearer ${applicantToken}`,
            Cookie: `token=${applicantToken}`,
        },
    });
    assert(applicantQueueRes.status === 403, `Non-reviewer applicant blocked with 403 Forbidden (got ${applicantQueueRes.status})`);

    // 12b: Club applicant check-access -> isReviewer: false
    const applicantCheckAccessRes = await fetch(`${baseUrl}/api/club/reviewer/check-access`, {
        headers: {
            Authorization: `Bearer ${applicantToken}`,
            Cookie: `token=${applicantToken}`,
        },
    });
    const applicantCheckAccessData: any = await applicantCheckAccessRes.json();
    assert(applicantCheckAccessData.isReviewer === false, "check-access returns isReviewer: false for club applicant");

    // 12c: Generate reviewer token (for staff@orbix.dev)
    const reviewerAllowlist = getReviewerAllowlist();
    assert(reviewerAllowlist.includes(REVIEWER_EMAIL.toLowerCase()), `Test reviewer email ${REVIEWER_EMAIL} is in allowlist`);

    const reviewerUserId = crypto.randomUUID();
    await query(`
        INSERT INTO auth.users (id, email, encrypted_password, role, aud, created_at, updated_at)
        VALUES ($1, $2, '$2b$10$abcdefghijklmnopqrstuv', 'authenticated', 'authenticated', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    `, [reviewerUserId, REVIEWER_EMAIL]).catch(() => {});

    await query(`
        INSERT INTO users (id, username, email, password, firstname, lastname, termsaccepted, account_type)
        VALUES ($1, 'orbixreviewer', $2, '$2b$10$abcdefghijklmnopqrstuv', 'Staff', 'Reviewer', true, 'admin')
        ON CONFLICT (id) DO NOTHING;
    `, [reviewerUserId, REVIEWER_EMAIL]);

    const { userDetailsCache } = await import("./src/redis/cache/cache-auth.js");
    await userDetailsCache({
        id: reviewerUserId,
        firstName: "Staff",
        lastName: "Reviewer",
        gmail: REVIEWER_EMAIL,
        username: "orbixreviewer",
        termsAccepted: true,
        accountType: "admin",
    });

    const reviewerToken = jwt.sign(
        {
            sub: reviewerUserId,
            gmail: REVIEWER_EMAIL,
            username: "orbixreviewer",
            accountType: "admin",
        },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "1h", issuer: "orbix", audience: "orbix-users" }
    );

    // 12d: Reviewer check-access -> isReviewer: true
    const reviewerCheckAccessRes = await fetch(`${baseUrl}/api/club/reviewer/check-access`, {
        headers: {
            Authorization: `Bearer ${reviewerToken}`,
            Cookie: `token=${reviewerToken}`,
        },
    });
    const reviewerCheckAccessData: any = await reviewerCheckAccessRes.json();
    assert(reviewerCheckAccessData.isReviewer === true, "check-access returns isReviewer: true for authorized reviewer");

    // 12e: Reviewer queue access -> 200 OK and contains our test request
    const reviewerQueueRes = await fetch(`${baseUrl}/api/club/reviewer/queue`, {
        headers: {
            Authorization: `Bearer ${reviewerToken}`,
            Cookie: `token=${reviewerToken}`,
        },
    });
    assert(reviewerQueueRes.status === 200, `Reviewer queue access granted with 200 OK (got ${reviewerQueueRes.status})`);
    const queueData: any = await reviewerQueueRes.json();
    assert(Array.isArray(queueData.requests), "Queue requests returned as array");
    const foundInQueue = queueData.requests.some((r: any) => r.id === verificationRequestId);
    assert(foundInQueue, "Newly registered club application appears in reviewer queue");

    // -------------------------------------------------------------------------
    // TEST 13: Status Transition & Verification Checklist Enforcement
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Reviewer Checklist Enforcement & State Transitions ---");

    // 13a: Attempting to jump directly from pending to ready_for_promotion -> 400 Invalid transition
    const jumpRes = await fetch(`${baseUrl}/api/club/reviewer/request/${verificationRequestId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${reviewerToken}`,
            Cookie: `token=${reviewerToken}`,
        },
        body: JSON.stringify({ status: "ready_for_promotion" }),
    });
    assert(jumpRes.status === 400, `Cannot jump directly from pending to ready_for_promotion (got ${jumpRes.status})`);

    // 13b: Valid transition from pending -> under_review
    const toReviewRes = await fetch(`${baseUrl}/api/club/reviewer/request/${verificationRequestId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${reviewerToken}`,
            Cookie: `token=${reviewerToken}`,
        },
        body: JSON.stringify({
            status: "under_review",
            internalNotes: "Application triage started by Orbix staff.",
        }),
    });
    assert(toReviewRes.status === 200, `Transition to under_review succeeded with 200 OK (got ${toReviewRes.status})`);
    const toReviewData: any = await toReviewRes.json();
    assert(toReviewData.request.status === "under_review", "Request status updated to 'under_review'");

    // 13c: Attempting to mark ready_for_promotion WITHOUT all 4 checklist items confirmed -> 400 Bad Request
    const prematurePromotionRes = await fetch(`${baseUrl}/api/club/reviewer/request/${verificationRequestId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${reviewerToken}`,
            Cookie: `token=${reviewerToken}`,
        },
        body: JSON.stringify({
            status: "ready_for_promotion",
            collegeContactStatus: "contacted", // Not yet confirmed!
            clubExistenceConfirmed: true,
            // collegeAuthorizationConfirmed missing
            // representativeAuthorityConfirmed missing
        }),
    });
    assert(prematurePromotionRes.status === 400, `Promotion rejected when checklist is incomplete with 400 Bad Request (got ${prematurePromotionRes.status})`);

    // 13d: Fully confirming all 4 verification checklist items AND marking ready_for_promotion -> 200 OK
    const fullVerificationRes = await fetch(`${baseUrl}/api/club/reviewer/request/${verificationRequestId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${reviewerToken}`,
            Cookie: `token=${reviewerToken}`,
        },
        body: JSON.stringify({
            collegeContactStatus: "confirmed",
            clubExistenceConfirmed: true,
            collegeAuthorizationConfirmed: true,
            representativeAuthorityConfirmed: true,
            internalNotes: "Verified with Dean of Student Affairs via official email. President credentials confirmed.",
            status: "ready_for_promotion",
        }),
    });
    assert(fullVerificationRes.status === 200, `Full verification & promotion succeeded with 200 OK (got ${fullVerificationRes.status})`);
    const fullVerData: any = await fullVerificationRes.json();
    assert(fullVerData.request.status === "ready_for_promotion", "Request status transitioned to 'ready_for_promotion'");
    assert(fullVerData.request.college_contact_status === "confirmed", "College contact status is 'confirmed'");
    assert(fullVerData.request.club_existence_confirmed === true, "Club existence confirmed is true");
    assert(fullVerData.request.college_authorization_confirmed === true, "College authorization confirmed is true");
    assert(fullVerData.request.representative_authority_confirmed === true, "Representative authority confirmed is true");

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP TEST DATA ---");
    await query("DELETE FROM club_verification_requests WHERE LOWER(contact_email) = LOWER($1);", [TEST_EMAIL]);
    await query("DELETE FROM users WHERE LOWER(email) = LOWER($1);", [TEST_EMAIL]);
    await query("DELETE FROM users WHERE LOWER(email) = LOWER($1);", [REVIEWER_EMAIL]);
    await query("DELETE FROM auth.users WHERE LOWER(email) = LOWER($1);", [TEST_EMAIL]).catch(() => {});
    await query("DELETE FROM auth.users WHERE LOWER(email) = LOWER($1);", [REVIEWER_EMAIL]).catch(() => {});
    console.log("  ✓ Test records cleaned up from database");

    if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        console.log("  ✓ Test server closed");
    }

    await pool.end();
    console.log("  ✓ Database pool disconnected");

    await redis.quit();
    console.log("  ✓ Redis disconnected");

    console.log("\n========================================================");
    console.log("🎉 ALL CLUB PIPELINE INTEGRATION TESTS PASSED CLEANLY!");
    console.log("========================================================\n");
}

run().catch(async (err) => {
    console.error("\n❌ TEST SUITE RUNTIME ERROR:", err);
    if (server) {
        server.close();
    }
    try {
        await query("DELETE FROM club_verification_requests WHERE LOWER(contact_email) = LOWER($1);", [TEST_EMAIL]);
        await query("DELETE FROM users WHERE LOWER(email) = LOWER($1);", [TEST_EMAIL]);
        await query("DELETE FROM users WHERE LOWER(email) = LOWER($1);", [REVIEWER_EMAIL]);
        await query("DELETE FROM auth.users WHERE LOWER(email) = LOWER($1);", [TEST_EMAIL]).catch(() => {});
        await query("DELETE FROM auth.users WHERE LOWER(email) = LOWER($1);", [REVIEWER_EMAIL]).catch(() => {});
        await pool.end();
        await redis.quit();
    } catch {}
    process.exit(1);
});
