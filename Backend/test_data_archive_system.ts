import crypto from "crypto";
import bcrypt from "bcrypt";
import { query } from "./src/database/client.js";
import redis from "./src/redis/client.js";
import { DataArchiveService } from "./src/services/account/dataArchiveService.js";

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${msg}`);
        throw new Error(msg);
    }
    console.log(`  ✓ ${msg}`);
}

async function runDataArchiveTestSuite() {
    console.log("==================================================================");
    console.log("🚀 STARTING PRODUCTION DATA ARCHIVE & PORTABILITY TEST SUITE");
    console.log("   GDPR Article 20 / CCPA Portability & Step-Up Security Engine");
    console.log("==================================================================\n");

    const testEmail = `test_archive_${Date.now()}@testorbix.com`;
    const testUsername = `user_arch_${Date.now().toString().slice(-6)}`;
    const testPlainPassword = "SecureArchivePass123!";
    const testHashedPassword = await bcrypt.hash(testPlainPassword, 10);
    let testUserId = "";

    try {
        // ------------------------------------------------------------------------
        // STEP 1: Provision rich test user across multiple relational domains
        // ------------------------------------------------------------------------
        console.log("📋 [TEST 1] Setting up rich test user with multi-domain relational data...");

        const userInsertRes = await query(
            `INSERT INTO users (
                email, username, password, firstname, lastname,
                is_email_verified, email_verified_at, college, account_type, bio
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
            RETURNING id;`,
            [
                testEmail,
                testUsername,
                testHashedPassword,
                "Ada",
                "Lovelace",
                true,
                "University of Oxford",
                "personal",
                "Pioneer of computing and algorithmic systems analysis."
            ]
        );
        testUserId = userInsertRes.rows[0].id;
        assert(Boolean(testUserId), `User created in PostgreSQL with ID: ${testUserId}`);

        // Insert platform links
        await query(
            `INSERT INTO user_links (user_id, portal, portal_username, link, stats, verified)
             VALUES ($1, 'leetcode', 'adalovelace', 'https://leetcode.com/adalovelace', '{"totalSolved": 450, "ranking": 12050, "reputation": 320}'::jsonb, true),
                    ($1, 'github', 'adalovelace-math', 'https://github.com/adalovelace-math', '{"publicRepos": 42, "followers": 1500, "totalStars": 380}'::jsonb, true);`,
            [testUserId]
        );
        console.log("  ✓ Inserted LeetCode and GitHub platform records into user_links");

        // Insert resume and analysis
        const resumeRes = await query(
            `INSERT INTO user_resumes (user_id, username, title, target_role, template_id, content, completeness_score, is_primary)
             VALUES ($1, $2, 'Ada_Lovelace_CV', 'Algorithm Engineer', 'modern_slate', '{"skills": ["Symbolic Logic", "Analytical Engines"]}'::jsonb, 95, true)
             RETURNING id;`,
            [testUserId, testUsername]
        );
        const resumeId = resumeRes.rows[0]?.id;
        if (resumeId) {
            await query(
                `INSERT INTO resume_analyses (user_id, username, resume_id, overall_score, analyzer_version, score_breakdown, findings, job_match_report)
                 VALUES ($1, $2, $3, 96, '2.0.0',
                         '{"ats": 96, "content": 94, "structure": 98}'::jsonb,
                         '{"strengths": ["Mathematical foundations", "Analytical reasoning"]}'::jsonb,
                         '{"fitTier": "Strong Fit", "targetRole": "Algorithm Engineer"}'::jsonb);`,
                [testUserId, testUsername, resumeId]
            );
            console.log("  ✓ Inserted user_resumes and resume_analyses records");
        }

        // Insert support ticket
        await query(
            `INSERT INTO help_tickets (user_id, username, ticket_number, subject, description, category, status, priority, contact_email)
             VALUES ($1, $2, 'TICK-TEST-999', 'API Rate Limit Inquiries', 'Question about developer API limits', 'general_inquiry', 'closed', 'low', $3);`,
            [testUserId, testUsername, testEmail]
        );
        console.log("  ✓ Inserted support ticket into help_tickets");

        // Insert account change audit log
        await query(
            `INSERT INTO account_change_history (user_id, change_type, old_value, new_value, ip_address, user_agent)
             VALUES ($1, 'email_change', 'ada.old@testorbix.com', $2, '127.0.0.1', 'Mozilla/5.0 TestSuite');`,
            [testUserId, testEmail]
        );
        console.log("  ✓ Inserted account change history audit record");

        // Clear any leftover redis keys for this user
        if (redis && redis.status === "ready") {
            await redis.del(`data_archive:daily:${testUserId}`);
            await redis.del(`data_archive:cooldown:${testUserId}`);
            await redis.del(`otp:data_archive:${testUserId}`);
            await redis.del(`otp:data_archive_cooldown:${testUserId}`);
        }

        // ------------------------------------------------------------------------
        // STEP 2: Test getArchiveInfo
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 2] Testing DataArchiveService.getArchiveInfo...");
        const info = await DataArchiveService.getArchiveInfo(testUserId);
        assert(info.availableCategories.length === 6, "Exposes 6 distinct data domains");
        assert(info.dailyLimit === 5, "Daily quota is set to 5 exports per 24 hours");
        assert(info.dailyExportsUsed === 0, "Initial daily exports used is 0");
        assert(info.dailyExportsRemaining === 5, "Initial daily exports remaining is 5");
        assert(info.canExport === true, "User is currently eligible to export");
        assert(info.hasPasswordAuth === true, "User has password auth configured");
        assert(info.primaryEmail === testEmail, "Primary email matches user record");

        // ------------------------------------------------------------------------
        // STEP 3: Test requestStepUpCode (Email OTP) & Cooldown
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 3] Testing Email OTP Step-Up authorization flow...");
        const otpRes = await DataArchiveService.requestStepUpCode(testUserId);
        assert(otpRes.success === true, "OTP request succeeded");
        assert(Boolean(otpRes.devOtp), "OTP received in test/dev environment");
        assert(otpRes.cooldownSeconds === 60, "Cooldown of 60 seconds set");

        const receivedOtp = otpRes.devOtp!;
        console.log(`  ✓ Received Step-Up OTP: ${receivedOtp}`);

        // Verify cooldown rejection on immediate retry
        try {
            await DataArchiveService.requestStepUpCode(testUserId);
            assert(false, "Should have thrown 429 cooldown error");
        } catch (err: any) {
            assert(err.statusCode === 429, "Immediate retry rejected with HTTP 429 cooldown error");
        }

        // ------------------------------------------------------------------------
        // STEP 4: Test Step-Up Validation (Rejection on Bad Credentials)
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 4] Testing Step-Up security validation gates...");

        // Wrong OTP
        try {
            await DataArchiveService.generateArchive({
                userId: testUserId,
                categories: "all",
                stepUpOtp: "000000",
            });
            assert(false, "Should have rejected invalid OTP");
        } catch (err: any) {
            assert(err.statusCode === 401, "Invalid OTP correctly rejected with HTTP 401");
        }

        // Wrong Password
        try {
            await DataArchiveService.generateArchive({
                userId: testUserId,
                categories: "all",
                stepUpPassword: "WrongPassword999!",
            });
            assert(false, "Should have rejected invalid password");
        } catch (err: any) {
            assert(err.statusCode === 401, "Invalid password correctly rejected with HTTP 401");
        }

        // ------------------------------------------------------------------------
        // STEP 5: Test Successful Dynamic Archive Generation (Full Scope)
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 5] Generating complete dynamic archive with valid Step-Up password...");
        const archiveResult = await DataArchiveService.generateArchive({
            userId: testUserId,
            categories: "all",
            stepUpPassword: testPlainPassword,
            ipAddress: "127.0.0.1",
            userAgent: "Orbix-Portability-Test/1.0",
        });

        assert(Boolean(archiveResult.exportId), `Export generated with UUID: ${archiveResult.exportId}`);
        assert(archiveResult.filename.includes(testUsername), "Filename contains normalized username");
        assert(archiveResult.filename.endsWith(".json"), "Filename is a .json export");
        assert(Boolean(archiveResult.sha256Checksum), `SHA-256 Checksum generated: ${archiveResult.sha256Checksum}`);
        assert(archiveResult.fileSizeBytes > 100, `Archive size is realistic (${archiveResult.fileSizeBytes} bytes)`);

        const payload = archiveResult.archivePayload;

        // Verify Manifest
        assert(payload.archiveManifest.exportId === archiveResult.exportId, "Manifest exportId matches");
        assert(payload.archiveManifest.complianceStandard.includes("GDPR Article 20"), "Manifest cites GDPR Article 20");
        assert(payload.archiveManifest.complianceStandard.includes("CCPA"), "Manifest cites CCPA Standard");

        // Verify Real Dynamic Data in Identity Domain
        assert(payload.data.identity.email === testEmail, "Dynamic identity contains real email");
        assert(payload.data.identity.username === testUsername, "Dynamic identity contains real username");
        assert(payload.data.identity.academicAffiliation?.college === "University of Oxford", "Dynamic identity contains real college");
        assert(payload.data.identity.verificationStamps?.isEmailVerified === true, "Dynamic identity contains email verification status");
        assert(!("password" in payload.data.identity), "Sensitive password hash strictly excluded from identity");

        // Verify Real Dynamic Data in Competitive Programming Domain
        assert(Array.isArray(payload.data.competitiveProgramming), "Competitive programming is an array");
        assert(payload.data.competitiveProgramming.some((p: any) => p.portal === "leetcode" && p.scrapedStats?.totalSolved === 450), "Dynamic platforms contains real LeetCode stats");
        assert(payload.data.competitiveProgramming.some((p: any) => p.portal === "github" && p.scrapedStats?.followers === 1500), "Dynamic platforms contains real GitHub stats");

        // Verify Real Dynamic Data in Resumes Domain
        assert(Array.isArray(payload.data.resumesAndCareer.activeResumes), "Active resumes is an array");
        assert(payload.data.resumesAndCareer.activeResumes.length >= 1, "Dynamic resumes contains uploaded CV");
        assert(payload.data.resumesAndCareer.atsAnalysesAndRoleFit.length >= 1, "Resume contains linked AI analysis");
        assert(payload.data.resumesAndCareer.atsAnalysesAndRoleFit[0].overallAtsScore === 96, "Dynamic resume analysis contains real ATS score");

        // Verify Real Dynamic Data in Security Domain
        assert(Array.isArray(payload.data.securityAndAuditHistory.committedAccountChanges), "Security audit contains change history");
        assert(payload.data.securityAndAuditHistory.committedAccountChanges.length >= 1, "Change history contains recorded audit trail");

        // Verify Real Dynamic Data in Support Domain
        assert(Array.isArray(payload.data.supportAndTickets), "Support tickets is an array");
        assert(payload.data.supportAndTickets.some((t: any) => t.ticketNumber === "TICK-TEST-999"), "Dynamic support contains real ticket");

        // ------------------------------------------------------------------------
        // STEP 6: Verify Cryptographic Integrity Seal (Deterministic SHA-256)
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 6] Validating Cryptographic SHA-256 Seal...");
        const calculatedSha256 = crypto
            .createHash("sha256")
            .update(JSON.stringify({ executiveSummary: payload.executiveSummary, data: payload.data }, null, 2))
            .digest("hex");

        assert(calculatedSha256 === payload.archiveManifest.sha256Checksum, "Deterministic SHA-256 matches manifest checksum exactly");
        assert(calculatedSha256 === archiveResult.sha256Checksum, "Calculated checksum matches returned result");
        console.log(`  ✓ Cryptographic Seal Verified: ${calculatedSha256}`);

        // ------------------------------------------------------------------------
        // STEP 7: Verify Database Persistence in account_data_exports
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 7] Verifying PostgreSQL audit persistence in account_data_exports...");
        const dbExportRes = await query(
            `SELECT * FROM account_data_exports WHERE export_id = $1;`,
            [archiveResult.exportId]
        );
        assert(dbExportRes.rows.length === 1, "Database record persisted in account_data_exports");
        const exportRow = dbExportRes.rows[0];
        assert(exportRow.user_id === testUserId, "Database record user_id matches");
        assert(exportRow.sha256_checksum === archiveResult.sha256Checksum, "Database sha256_checksum matches");
        assert(exportRow.file_size_bytes === archiveResult.fileSizeBytes, "Database file_size_bytes matches");
        assert(exportRow.ip_address === "127.0.0.1", "Database audit log captured IP address");

        // ------------------------------------------------------------------------
        // STEP 8: Verify Redis Payload Caching & Instant Retrieval
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 8] Verifying Redis Payload Caching & Fast Download...");
        const cachedPayload = await DataArchiveService.getCachedArchivePayload(testUserId, archiveResult.exportId);
        assert(Boolean(cachedPayload), "Payload successfully fetched from cache/db");
        assert(cachedPayload.archiveManifest.exportId === archiveResult.exportId, "Cached payload exportId matches");
        assert(cachedPayload.archiveManifest.sha256Checksum === archiveResult.sha256Checksum, "Cached payload integrity verified");

        // ------------------------------------------------------------------------
        // STEP 9: Test Scoped / Custom Category Selection
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 9] Testing custom category scoping (GDPR Data Minimization)...");

        // Reset cooldown in redis for testing
        if (redis && redis.status === "ready") {
            await redis.del(`data_archive:cooldown:${testUserId}`);
        }

        const scopedResult = await DataArchiveService.generateArchive({
            userId: testUserId,
            categories: ["identity", "platforms"],
            stepUpPassword: testPlainPassword,
        });

        assert(scopedResult.archivePayload.executiveSummary.includedCategories.length === 2, "Scoped export metadata records 2 categories");
        assert(Boolean(scopedResult.archivePayload.data.identity), "Scoped payload includes requested identity domain");
        assert(Boolean(scopedResult.archivePayload.data.competitiveProgramming), "Scoped payload includes requested platforms domain");
        assert(scopedResult.archivePayload.data.resumesAndCareer === undefined, "Resumes domain excluded according to user scope");
        assert(scopedResult.archivePayload.data.securityAndAuditHistory === undefined, "Security audit excluded according to user scope");
        assert(scopedResult.archivePayload.data.supportAndTickets === undefined, "Support domain excluded according to user scope");

        // ------------------------------------------------------------------------
        // STEP 10: Test Rate Limiting & Cooldown Protection
        // ------------------------------------------------------------------------
        console.log("\n📋 [TEST 10] Testing Cooldown (60s) and Daily Quota (5/day)...");

        // Immediate retry should fail with cooldown
        try {
            await DataArchiveService.generateArchive({
                userId: testUserId,
                categories: "all",
                stepUpPassword: testPlainPassword,
            });
            assert(false, "Should have thrown cooldown error");
        } catch (err: any) {
            assert(err.statusCode === 429, "Immediate generation rejected with cooldown HTTP 429");
        }

        // Simulate daily limit exhausted in Redis
        if (redis && redis.status === "ready") {
            await redis.del(`data_archive:cooldown:${testUserId}`);
            await redis.set(`data_archive:daily:${testUserId}`, "5", "EX", 86400);
        }

        try {
            await DataArchiveService.generateArchive({
                userId: testUserId,
                categories: "all",
                stepUpPassword: testPlainPassword,
            });
            assert(false, "Should have thrown daily limit exceeded");
        } catch (err: any) {
            assert(err.statusCode === 429, "Daily quota limit strictly enforced with HTTP 429");
            assert(err.message.includes("Daily export limit reached"), "Error message clarifies daily limit");
        }

        console.log("\n==================================================================");
        console.log("🎉 ALL DATA ARCHIVE & PORTABILITY TESTS PASSED WITH 100% SUCCESS!");
        console.log("==================================================================\n");
    } finally {
        // Cleanup test user and associated records
        if (testUserId) {
            console.log("🧹 Cleaning up test user and associated tables...");
            await query(`DELETE FROM account_data_exports WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM account_change_history WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM help_tickets WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM resume_analyses WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM user_resumes WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM user_links WHERE user_id = $1;`, [testUserId]);
            await query(`DELETE FROM users WHERE id = $1;`, [testUserId]);

            if (redis && redis.status === "ready") {
                await redis.del(`data_archive:daily:${testUserId}`);
                await redis.del(`data_archive:cooldown:${testUserId}`);
                await redis.del(`otp:data_archive:${testUserId}`);
                await redis.del(`otp:data_archive_cooldown:${testUserId}`);
            }
            console.log("  ✓ Test artifacts successfully cleaned up.");
        }
    }
}

runDataArchiveTestSuite()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ Test suite encountered fatal error:", err);
        process.exit(1);
    });
