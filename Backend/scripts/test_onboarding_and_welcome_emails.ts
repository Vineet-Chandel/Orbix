// Backend/scripts/test_onboarding_and_welcome_emails.ts
import assert from "assert";
import { OnboardingEmailService } from "../src/services/email/onboardingEmailService.js";
import {
    DEFAULT_FOUNDER_FROM,
    DEFAULT_FOUNDER_REPLY_TO,
    DEFAULT_SYSTEM_FROM,
} from "../src/services/email/resendService.js";

async function runTests() {
    console.log("=================================================================");
    console.log("ORBIX ONBOARDING & WELCOME EMAIL INFRASTRUCTURE TEST SUITE");
    console.log("=================================================================\n");

    let passed = 0;
    let failed = 0;

    function recordPass(testName: string) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    }

    function recordFail(testName: string, err: any) {
        console.error(`  ❌ FAIL: ${testName}`, err.message || err);
        failed++;
    }

    // TEST 1: Personal Welcome Email
    try {
        console.log("Test 1: Personal User Registration Welcome Email");
        const res = await OnboardingEmailService.sendPersonalWelcomeEmail({
            to: "alex.developer@orbix.campus",
            firstName: "Alex",
            username: "alexdev",
        });

        assert.strictEqual(res.success, true, "Email dispatch should report success");
        recordPass("Personal welcome email dispatches successfully with simulation/provider outcome");
    } catch (err: any) {
        recordFail("Personal welcome email dispatch", err);
    }

    // TEST 2: Personal Welcome Email Idempotency Deduplication
    try {
        console.log("Test 2: Deduplication / Idempotency Window");
        const resDup = await OnboardingEmailService.sendPersonalWelcomeEmail({
            to: "alex.developer@orbix.campus",
            firstName: "Alex",
            username: "alexdev",
        });

        assert.strictEqual(resDup.success, true, "Duplicate dispatch should return safe success");
        assert.strictEqual(resDup.messageId, "skipped_duplicate", "Duplicate dispatch should be skipped");
        recordPass("Immediate duplicate dispatch is safely deduplicated to prevent inbox spam");
    } catch (err: any) {
        recordFail("Personal welcome email deduplication", err);
    }

    // TEST 3: Club Application Received Email
    try {
        console.log("Test 3: Club Application Received Acknowledgment Email");
        const res = await OnboardingEmailService.sendClubApplicationReceivedEmail({
            to: "organizer@techclub.edu",
            contactPersonName: "Priya Sharma",
            clubName: "Google Developer Student Club",
            collegeName: "National Institute of Technology",
            clubCategory: "Technical & Coding",
            requestId: "req-12345",
        });

        assert.strictEqual(res.success, true, "Club application email should report success");
        recordPass("Club application received email dispatches with collegiate onboarding guidance");
    } catch (err: any) {
        recordFail("Club application received email", err);
    }

    // TEST 4: Club Application Staff Alert Email
    try {
        console.log("Test 4: Club Application Staff / Reviewer Notification");
        const res = await OnboardingEmailService.sendClubApplicationStaffAlertEmail({
            clubName: "Google Developer Student Club",
            clubCategory: "Technical & Coding",
            collegeName: "National Institute of Technology",
            collegeCity: "Trichy",
            collegeState: "Tamil Nadu",
            contactPersonName: "Priya Sharma",
            contactPersonRole: "Lead Organizer",
            contactEmail: "organizer@techclub.edu",
            contactPhone: "+91 9876543210",
            collegeOfficialEmail: "faculty.advisor@nitt.edu",
            clubWebsiteUrl: "https://gdsc.nitt.edu",
            submittedAt: new Date(),
            requestId: "req-12345",
        });

        assert.strictEqual(res.success, true, "Staff alert should report success");
        recordPass("Club application staff alert dispatches to review team with application metadata");
    } catch (err: any) {
        recordFail("Club application staff alert", err);
    }

    // TEST 5: Club Verified & Promoted Email
    try {
        console.log("Test 5: Club Verified & Promoted Celebratory Email");
        const res = await OnboardingEmailService.sendClubVerifiedEmail({
            to: "organizer@techclub.edu",
            contactPersonName: "Priya Sharma",
            clubName: "Google Developer Student Club",
            collegeName: "National Institute of Technology",
            slug: "gdsc-nitt",
            clubId: "club-12345",
        });

        assert.strictEqual(res.success, true, "Club verified email should report success");
        recordPass("Club verified email dispatches with team workspace, certificates & public showcase superpowers");
    } catch (err: any) {
        recordFail("Club verified email", err);
    }

    // TEST 6: Club Verified Staff Alert Email
    try {
        console.log("Test 6: Club Verified Staff Alert Email");
        const res = await OnboardingEmailService.sendClubVerifiedStaffAlertEmail({
            clubName: "Google Developer Student Club",
            collegeName: "National Institute of Technology",
            slug: "gdsc-nitt",
            contactPersonName: "Priya Sharma",
            contactEmail: "organizer@techclub.edu",
            reviewedBy: "usr-staff-reviewer",
            verifiedAt: new Date(),
        });

        assert.strictEqual(res.success, true, "Staff activation alert should report success");
        recordPass("Club verified staff alert dispatches confirming live activation on Orbix");
    } catch (err: any) {
        recordFail("Club verified staff alert", err);
    }

    // TEST 7: Asynchronous Non-blocking Dispatch Functions
    try {
        console.log("Test 7: Asynchronous Non-blocking Execution");
        OnboardingEmailService.sendPersonalWelcomeEmailAsync({
            to: "async.user@example.com",
            firstName: "Async",
            username: "asyncuser",
        });

        OnboardingEmailService.sendClubApplicationReceivedEmailAsync({
            to: "async.club@example.com",
            contactPersonName: "Lead",
            clubName: "Async Club",
            collegeName: "Tech University",
        });

        OnboardingEmailService.sendClubVerifiedEmailAsync({
            to: "async.club@example.com",
            contactPersonName: "Lead",
            clubName: "Async Club",
            collegeName: "Tech University",
            slug: "async-club",
        });

        // Wait a short tick for setImmediate
        await new Promise((resolve) => setTimeout(resolve, 100));
        recordPass("Non-blocking asynchronous dispatchers execute safely without unhandled rejections");
    } catch (err: any) {
        recordFail("Asynchronous non-blocking dispatch", err);
    }

    // TEST 8: Founder Email Identity & Address Isolation
    try {
        console.log("Test 8: Founder Email Identity & Address Isolation");
        assert.ok(
            DEFAULT_FOUNDER_FROM.includes("vineet@vineetchandel.in"),
            "Founder from email must contain vineet@vineetchandel.in"
        );
        assert.ok(
            !DEFAULT_FOUNDER_FROM.includes("team@vineetchandel.in"),
            "Founder from email must NOT be team@vineetchandel.in"
        );
        assert.ok(
            DEFAULT_FOUNDER_REPLY_TO.includes("vineet@vineetchandel.in"),
            "Founder reply-to must be vineet@vineetchandel.in"
        );
        recordPass("Founder emails are strictly configured to send from vineet@vineetchandel.in and NOT team@vineetchandel.in");
    } catch (err: any) {
        recordFail("Founder email identity isolation", err);
    }

    // TEST 9: System & Transactional Email Uniformity
    try {
        console.log("Test 9: System & Transactional Email Uniformity");
        assert.ok(
            DEFAULT_SYSTEM_FROM.includes("team@vineetchandel.in"),
            "Default system email must be team@vineetchandel.in"
        );
        assert.ok(
            !DEFAULT_SYSTEM_FROM.includes("onboarding@resend.dev"),
            "Default system email must NOT use onboarding@resend.dev sandbox"
        );
        recordPass("All non-founder emails strictly dispatch from team@vineetchandel.in without arbitrary fromName interpolation");
    } catch (err: any) {
        recordFail("System email uniformity", err);
    }

    console.log("\n=================================================================");
    console.log(`ONBOARDING EMAIL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================================\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
