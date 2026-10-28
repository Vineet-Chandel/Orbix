process.env.NODE_ENV = "test";
import { query, pool } from "./src/database/client.js";
import redis from "./src/redis/client.js";
import { ManageAccountsService } from "./src/services/account/manageAccountsService.js";
import { EmailVerificationService } from "./src/services/email/emailVerificationService.js";
import bcrypt from "bcrypt";

// Test counters
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
        console.log(`  ✓ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
        failed++;
    }
}

async function runManageAccountsTests() {
    console.log("================================================================================");
    console.log("       MANAGE ACCOUNTS PRODUCTION TEST SUITE — AUTOMATED VERIFICATION           ");
    console.log("================================================================================\n");

    const ts = Date.now().toString().slice(-6);
    const userAEmail = `test_owner_${ts}@resend.dev`;
    const userBEmail = `test_other_${ts}@resend.dev`;
    const userAUsername = `usr_test_a_${ts}`;
    const userBUsername = `usr_test_b_${ts}`;
    const passwordHash = await bcrypt.hash("Password123!", 10);

    let userAId: string = "";
    let userBId: string = "";

    try {
        // --- SETUP TEST USERS ---
        console.log("[Setup] Creating isolated test users in Supabase PostgreSQL...");

        const resA = await query(
            `INSERT INTO users (username, email, firstname, lastname, password, is_email_verified, account_type, is_public, created_at)
             VALUES ($1, $2, 'TesterA', 'Orbix', $3, false, 'personal', true, NOW())
             RETURNING id, username, email`,
            [userAUsername, userAEmail, passwordHash]
        );
        userAId = resA.rows[0].id;

        const resB = await query(
            `INSERT INTO users (username, email, firstname, lastname, password, is_email_verified, account_type, is_public, created_at)
             VALUES ($1, $2, 'TesterB', 'Orbix', $3, true, 'personal', true, NOW())
             RETURNING id, username, email`,
            [userBUsername, userBEmail, passwordHash]
        );
        userBId = resB.rows[0].id;

        console.log(`[Setup] User A created: ${userAId} (${userAEmail})`);
        console.log(`[Setup] User B created: ${userBId} (${userBEmail})\n`);

        // ============================================================================
        // TEST SUITE 1: Email Verification Status & Primary Email Verification
        // ============================================================================
        console.log("--- TEST SUITE 1: Email Verification Status & Primary Email Verification ---");
        {
            // Initial status: should be unverified
            const initialStatus = await ManageAccountsService.getStatus(userAId);
            assert(!initialStatus.isEmailVerified, "User A is initially unverified");
            assert(initialStatus.emailState === "email_verification_required", "State is email_verification_required");
            assert(initialStatus.monthlyLimits.email.remaining === 2, "2 email changes available initially");
            assert(initialStatus.monthlyLimits.username.remaining === 2, "2 username changes available initially");

            // Request primary verification OTP
            const otpReq = await EmailVerificationService.sendOtp({
                userId: userAId,
                email: userAEmail,
                name: "Test User A",
                ipAddress: "127.0.0.1",
                userAgent: "test-agent",
            });
            assert(otpReq.success, "Primary verification OTP requested successfully");
            assert(Boolean(otpReq.devOtp), "Test verification OTP generated");
            const testOtp = otpReq.devOtp!;

            // Attempt with invalid OTP
            let invalidOtpFailed = false;
            try {
                await EmailVerificationService.verifyOtp({
                    userId: userAId,
                    otp: "000000",
                    ipAddress: "127.0.0.1",
                });
            } catch (err: any) {
                invalidOtpFailed = true;
                assert(err.statusCode === 400 || err.message.includes("Invalid"), "Invalid OTP rejected with status 400");
            }
            assert(invalidOtpFailed, "Submitting invalid OTP throws an error");

            // Verify with valid OTP
            const verifySuccess = await EmailVerificationService.verifyOtp({
                userId: userAId,
                otp: testOtp,
                ipAddress: "127.0.0.1",
            });
            assert(verifySuccess.success, "Primary verification with valid OTP succeeds");
            assert(verifySuccess.isEmailVerified, "isEmailVerified returned true");

            // Check authoritative user record in PostgreSQL
            const checkUser = await query(`SELECT is_email_verified, email_verified_at FROM users WHERE id = $1`, [userAId]);
            assert(checkUser.rows[0].is_email_verified === true, "Database is_email_verified persisted as true");
            assert(checkUser.rows[0].email_verified_at !== null, "Database email_verified_at timestamp set");

            // Status should now be email_verified
            const updatedStatus = await ManageAccountsService.getStatus(userAId);
            assert(updatedStatus.isEmailVerified, "Manage Accounts status reports isEmailVerified = true");
            assert(updatedStatus.emailState === "email_verified", "emailState is email_verified");
        }

        // ============================================================================
        // TEST SUITE 2: Two-Step Secure Email Change Workflow
        // ============================================================================
        console.log("\n--- TEST SUITE 2: Two-Step Secure Email Change Workflow ---");
        const newEmailA1 = `test_new_${ts}@resend.dev`;
        let opId1 = "";
        {
            // Reject invalid format
            let malformedRejected = false;
            try {
                await ManageAccountsService.startEmailChange({
                    userId: userAId,
                    newEmail: "not-an-email",
                });
            } catch (err: any) {
                malformedRejected = true;
                assert(err.statusCode === 400 || err.status === 400, "Malformed email rejected with 400");
            }
            assert(malformedRejected, "startEmailChange rejects invalid email address");

            // Reject collision with existing user (User B)
            let collisionRejected = false;
            try {
                await ManageAccountsService.startEmailChange({
                    userId: userAId,
                    newEmail: userBEmail,
                });
            } catch (err: any) {
                collisionRejected = true;
                assert(err.statusCode === 409 || err.status === 409, "Existing email conflict rejected with 409");
            }
            assert(collisionRejected, "startEmailChange rejects collision with existing user");

            // Clear start cooldown in Redis for test speed
            await redis.del(`otp:acct_change_start:${userAId}`);

            // Step 1: Initiate change to newEmailA1
            const startRes = await ManageAccountsService.startEmailChange({
                userId: userAId,
                newEmail: newEmailA1,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            assert(startRes.success, "startEmailChange succeeded");
            assert(startRes.stage === "old_email_authorization_pending", "Stage is old_email_authorization_pending");
            assert(Boolean(startRes.devOtp), "Dev authorization OTP received for old email");
            opId1 = startRes.operationId;
            const oldOtp = startRes.devOtp!;

            // Verify user state: pending_email set, primary email UNCHANGED
            const userCheck1 = await query(`SELECT email, pending_email, pending_email_operation_id FROM users WHERE id = $1`, [userAId]);
            assert(userCheck1.rows[0].email === userAEmail, "Primary email remains unchanged during transition");
            assert(userCheck1.rows[0].pending_email === newEmailA1, "pending_email is set to proposed address");

            // Verify challenge record exists in database
            const chalOldRes = await query(
                `SELECT id, otp_hash FROM account_change_challenges
                 WHERE operation_id = $1 AND challenge_type = 'old_email_auth' AND status = 'pending'`,
                [opId1]
            );
            assert(chalOldRes.rows.length > 0, "Challenge record generated in account_change_challenges for old email");

            // Submit invalid OTP for Step 1
            let invalidOldOtpFailed = false;
            try {
                await ManageAccountsService.authorizeOldEmail({
                    userId: userAId,
                    operationId: opId1,
                    otp: "999999",
                });
            } catch (err: any) {
                invalidOldOtpFailed = true;
                assert(err.statusCode === 400 || err.status === 400, "Invalid old email OTP rejected");
            }
            assert(invalidOldOtpFailed, "authorizeOldEmail rejects wrong code");

            // Submit valid old email OTP -> transitions to Step 2
            const authRes = await ManageAccountsService.authorizeOldEmail({
                userId: userAId,
                operationId: opId1,
                otp: oldOtp,
            });
            assert(authRes.success, "authorizeOldEmail succeeded");
            assert(authRes.stage === "new_email_verification_pending", "Stage transitioned to new_email_verification_pending");
            assert(Boolean(authRes.devOtp), "Dev verification OTP received for new email");
            const newOtp = authRes.devOtp!;

            // Submit invalid OTP for Step 2
            let invalidNewOtpFailed = false;
            try {
                await ManageAccountsService.verifyNewEmailAndCommit({
                    userId: userAId,
                    operationId: opId1,
                    otp: "999999",
                    clientIp: "127.0.0.1",
                    userAgent: "test-agent",
                });
            } catch (err: any) {
                invalidNewOtpFailed = true;
                assert(err.statusCode === 400 || err.status === 400, "Invalid new email OTP rejected");
            }
            assert(invalidNewOtpFailed, "verifyNewEmailAndCommit rejects wrong code");

            // Submit valid new email OTP -> commits change
            const commitRes = await ManageAccountsService.verifyNewEmailAndCommit({
                userId: userAId,
                operationId: opId1,
                otp: newOtp,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            assert(commitRes.success, "verifyNewEmail succeeded and committed change");
            assert(commitRes.newEmail === newEmailA1, "Committed email matches requested new email");
            assert(typeof commitRes.token === "string", "New session JWT generated with updated email claim");

            // Check authoritative user row
            const userCheck2 = await query(`SELECT email, pending_email, is_email_verified FROM users WHERE id = $1`, [userAId]);
            assert(userCheck2.rows[0].email === newEmailA1, "Primary email in PostgreSQL updated to new email");
            assert(userCheck2.rows[0].pending_email === null, "pending_email cleared in users table");
            assert(userCheck2.rows[0].is_email_verified === true, "New email marked verified in users table");

            // Check audit history entry
            const historyRes = await query(
                `SELECT change_type, old_value, new_value FROM account_change_history
                 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [userAId]
            );
            assert(historyRes.rows.length === 1, "Audit log record written to account_change_history");
            assert(historyRes.rows[0].change_type === "email", "Audit type is email");
            assert(historyRes.rows[0].old_value === userAEmail, "Old email logged correctly");
            assert(historyRes.rows[0].new_value === newEmailA1, "New email logged correctly");
        }

        // ============================================================================
        // TEST SUITE 3: Monthly Limit Enforcement & Independent Quotas (2 per UTC month)
        // ============================================================================
        console.log("\n--- TEST SUITE 3: Monthly Limit Enforcement & Independent Quotas ---");
        {
            // Status should now show 1 email change remaining this month
            const statusAfter1 = await ManageAccountsService.getStatus(userAId);
            assert(statusAfter1.monthlyLimits.email.remaining === 1, "1 email change remaining for User A");
            assert(statusAfter1.monthlyLimits.username.remaining === 2, "Username changes still at 2 (independent quota)");

            // Clear start cooldown in Redis
            await redis.del(`otp:acct_change_start:${userAId}`);

            // Perform 2nd email change
            const newEmailA2 = `test_new2_${ts}@resend.dev`;
            const start2 = await ManageAccountsService.startEmailChange({
                userId: userAId,
                newEmail: newEmailA2,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            const auth2 = await ManageAccountsService.authorizeOldEmail({
                userId: userAId,
                operationId: start2.operationId,
                otp: start2.devOtp!,
            });
            await ManageAccountsService.verifyNewEmailAndCommit({
                userId: userAId,
                operationId: start2.operationId,
                otp: auth2.devOtp!,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });

            // Status should now show 0 email changes remaining
            const statusAfter2 = await ManageAccountsService.getStatus(userAId);
            assert(statusAfter2.monthlyLimits.email.remaining === 0, "0 email changes remaining (limit 2 reached)");

            // Clear start cooldown to verify quota block directly
            await redis.del(`otp:acct_change_start:${userAId}`);

            // Attempt 3rd email change in same calendar month -> MUST BE REJECTED
            let thirdChangeBlocked = false;
            try {
                await ManageAccountsService.startEmailChange({
                    userId: userAId,
                    newEmail: `test_new3_${ts}@resend.dev`,
                });
            } catch (err: any) {
                thirdChangeBlocked = true;
                assert(err.statusCode === 429 || err.status === 429, "3rd email change in same month rejected with status 429");
                assert(err.message.includes("Monthly email change limit reached"), "Error message specifies monthly limit");
            }
            assert(thirdChangeBlocked, "3rd email change blocked by monthly quota");

            // Verify UTC window calculation
            const quota = await ManageAccountsService.getMonthlyQuota(userAId, "email");
            assert(quota.used === 2, "Monthly quota reports exactly 2 used");
            assert(quota.remaining === 0, "Monthly quota reports 0 remaining");
            assert(Boolean(quota.nextResetAt), "nextResetAt date returned");
        }

        // ============================================================================
        // TEST SUITE 4: Username Validation, Availability & Step-Up Verification
        // ============================================================================
        console.log("\n--- TEST SUITE 4: Username Change Workflow & Validation ---");
        {
            // Reserved words
            const reservedCheck = await ManageAccountsService.checkUsernameAvailability("admin", userAId);
            assert(!reservedCheck.available, "'admin' recognized as reserved");
            assert(reservedCheck.reason?.includes("reserved"), "Reason indicates reserved route");

            // Format validation
            const invalidCheck = await ManageAccountsService.checkUsernameAvailability("bad username with spaces!", userAId);
            assert(!invalidCheck.available, "Username with spaces/symbols rejected");

            // Existing username collision
            const takenCheck = await ManageAccountsService.checkUsernameAvailability(userBUsername, userAId);
            assert(!takenCheck.available, "Existing username recognized as taken");

            // Available valid username
            const targetUsername1 = `coder_${ts}_1`;
            const validCheck = await ManageAccountsService.checkUsernameAvailability(targetUsername1, userAId);
            assert(validCheck.available, "Unique alphanumeric username is available");

            // Request username change -> creates step-up challenge
            const reqUsername = await ManageAccountsService.requestUsernameChange({
                userId: userAId,
                newUsername: targetUsername1,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            assert(reqUsername.success, "Username change request created successfully");
            assert(reqUsername.stepUpType === "email_otp", "Step-up verification via email OTP required");
            assert(Boolean(reqUsername.devOtp), "Step-up OTP code provided");
            const usernameOtp1 = reqUsername.devOtp!;

            // Confirm with wrong code
            let wrongUsernameCodeFailed = false;
            try {
                await ManageAccountsService.confirmUsernameChange({
                    userId: userAId,
                    newUsername: targetUsername1,
                    operationId: reqUsername.operationId!,
                    otp: "000000",
                });
            } catch (err: any) {
                wrongUsernameCodeFailed = true;
                assert(err.statusCode === 400 || err.status === 400, "Wrong step-up code rejected with 400");
            }
            assert(wrongUsernameCodeFailed, "confirmUsernameChange rejected wrong code");

            // Confirm with valid step-up code
            const confirmUserRes = await ManageAccountsService.confirmUsernameChange({
                userId: userAId,
                newUsername: targetUsername1,
                operationId: reqUsername.operationId!,
                otp: usernameOtp1,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            assert(confirmUserRes.success, "Username change committed with valid step-up code");
            assert(confirmUserRes.newUsername === targetUsername1, "Returned username matches target");

            // Verify in PostgreSQL
            const checkUserRow = await query(`SELECT username FROM users WHERE id = $1`, [userAId]);
            assert(checkUserRow.rows[0].username === targetUsername1, "Database username updated");

            // Check username monthly limit count (1 change done, 1 remaining)
            const statusUser1 = await ManageAccountsService.getStatus(userAId);
            assert(statusUser1.monthlyLimits.username.remaining === 1, "1 username change remaining");

            // Perform 2nd username change
            const targetUsername2 = `coder_${ts}_2`;
            const reqUser2 = await ManageAccountsService.requestUsernameChange({
                userId: userAId,
                newUsername: targetUsername2,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            await ManageAccountsService.confirmUsernameChange({
                userId: userAId,
                newUsername: targetUsername2,
                operationId: reqUser2.operationId!,
                otp: reqUser2.devOtp!,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });

            // Status should now show 0 username changes remaining
            const statusUser2 = await ManageAccountsService.getStatus(userAId);
            assert(statusUser2.monthlyLimits.username.remaining === 0, "0 username changes remaining");

            // Attempt 3rd username change -> MUST BE REJECTED
            let thirdUsernameBlocked = false;
            try {
                await ManageAccountsService.requestUsernameChange({
                    userId: userAId,
                    newUsername: `coder_${ts}_3`,
                });
            } catch (err: any) {
                thirdUsernameBlocked = true;
                assert(err.statusCode === 429 || err.status === 429, "3rd username change rejected with 429");
                assert(err.message.includes("Monthly username change limit reached"), "Rejection message specifies username limit");
            }
            assert(thirdUsernameBlocked, "3rd username change in same month blocked by quota");
        }

        // ============================================================================
        // TEST SUITE 5: Security, Rate Limiting, Replay & Isolation
        // ============================================================================
        console.log("\n--- TEST SUITE 5: Security, Cancellation, Replay & Isolation ---");
        {
            // Clear start cooldown on User B
            await redis.del(`otp:acct_change_start:${userBId}`);

            // Cancellation test on User B
            const cancelTargetEmail = `cancel_test_${ts}@resend.dev`;
            const cancelStart = await ManageAccountsService.startEmailChange({
                userId: userBId,
                newEmail: cancelTargetEmail,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            assert(cancelStart.success, "User B started email change for cancellation test");

            // Verify User B has pending_email
            const bPending = await query(`SELECT pending_email FROM users WHERE id = $1`, [userBId]);
            assert(bPending.rows[0].pending_email === cancelTargetEmail, "User B pending_email is set");

            // Cancel the change
            const cancelRes = await ManageAccountsService.cancelEmailChange(userBId, cancelStart.operationId);
            assert(cancelRes.success, "cancelEmailChange succeeded");

            // Verify User B pending_email cleared and operation marked canceled
            const bAfterCancel = await query(`SELECT email, pending_email FROM users WHERE id = $1`, [userBId]);
            assert(bAfterCancel.rows[0].email === userBEmail, "User B primary email intact");
            assert(bAfterCancel.rows[0].pending_email === null, "User B pending_email cleanly cleared");

            const opAfterCancel = await query(`SELECT stage FROM account_change_operations WHERE id = $1`, [cancelStart.operationId]);
            assert(opAfterCancel.rows[0].stage === "cancelled", "Operation status marked cancelled");

            // Replay protection: Attempting to authorize a canceled operation fails
            let replayFailed = false;
            try {
                await ManageAccountsService.authorizeOldEmail({
                    userId: userBId,
                    operationId: cancelStart.operationId,
                    otp: cancelStart.devOtp!,
                });
            } catch (err: any) {
                replayFailed = true;
                assert(err.statusCode === 400 || err.statusCode === 404, "Replay on canceled operation rejected");
            }
            assert(replayFailed, "Replay on non-pending operation is prevented");

            // Cross-User Isolation: User A attempts to cancel User B's operation
            let isolationFailed = false;
            try {
                await ManageAccountsService.cancelEmailChange(userAId, cancelStart.operationId);
            } catch (err: any) {
                isolationFailed = true;
                assert(err.statusCode === 404 || err.statusCode === 403, "Cross-user cancellation rejected");
            }
            assert(isolationFailed, "User A cannot modify or access User B's change operation");

            // Max attempts lockout: 5 failed attempts locks challenge
            await redis.del(`otp:acct_change_start:${userBId}`);
            const lockoutOp = await ManageAccountsService.startEmailChange({
                userId: userBId,
                newEmail: `lockout_${ts}@resend.dev`,
                clientIp: "127.0.0.1",
                userAgent: "test-agent",
            });
            for (let i = 0; i < 5; i++) {
                try {
                    await ManageAccountsService.authorizeOldEmail({
                        userId: userBId,
                        operationId: lockoutOp.operationId,
                        otp: "000000",
                    });
                } catch {}
            }
            let sixthAttemptRejected = false;
            try {
                await ManageAccountsService.authorizeOldEmail({
                    userId: userBId,
                    operationId: lockoutOp.operationId,
                    otp: "000000",
                });
            } catch (err: any) {
                sixthAttemptRejected = true;
                assert(err.message.includes("Maximum verification attempts exceeded") || err.message.includes("expired"), "Lockout after max attempts enforced");
            }
            assert(sixthAttemptRejected, "Challenge locked after maximum invalid attempts");
            await ManageAccountsService.cancelEmailChange(userBId, lockoutOp.operationId);
        }

        // ============================================================================
        // TEST SUITE 6: Concurrency & Race Conditions
        // ============================================================================
        console.log("\n--- TEST SUITE 6: Concurrency & Race Conditions ---");
        {
            await redis.del(`otp:acct_change_start:${userBId}`);

            const targetConcurrentEmail1 = `concurrent_1_${ts}@resend.dev`;
            const targetConcurrentEmail2 = `concurrent_2_${ts}@resend.dev`;

            const results = await Promise.allSettled([
                ManageAccountsService.startEmailChange({
                    userId: userBId,
                    newEmail: targetConcurrentEmail1,
                }),
                ManageAccountsService.startEmailChange({
                    userId: userBId,
                    newEmail: targetConcurrentEmail2,
                }),
            ]);

            const fulfilled = results.filter((r) => r.status === "fulfilled");
            assert(fulfilled.length >= 1, "Concurrent change requests handled cleanly");

            // Clean up User B pending changes
            const bState = await query(`SELECT pending_email_operation_id FROM users WHERE id = $1`, [userBId]);
            if (bState.rows[0]?.pending_email_operation_id) {
                await ManageAccountsService.cancelEmailChange(userBId, bState.rows[0].pending_email_operation_id);
            }
        }

    } catch (unexpectedErr: any) {
        console.error("\n[CRITICAL UNEXPECTED ERROR IN TEST SUITE]", unexpectedErr);
        failed++;
    } finally {
        // --- CLEANUP TEST DATA ---
        console.log("\n[Cleanup] Cleaning up test data in PostgreSQL & Redis...");
        try {
            if (userAId) {
                await query(`DELETE FROM account_change_challenges WHERE operation_id IN (SELECT id FROM account_change_operations WHERE user_id = $1)`, [userAId]);
                await query(`DELETE FROM account_change_history WHERE user_id = $1`, [userAId]);
                await query(`DELETE FROM account_change_operations WHERE user_id = $1`, [userAId]);
                await query(`DELETE FROM email_verification_otps WHERE user_id = $1`, [userAId]);
                await query(`DELETE FROM users WHERE id = $1`, [userAId]);
            }
            if (userBId) {
                await query(`DELETE FROM account_change_challenges WHERE operation_id IN (SELECT id FROM account_change_operations WHERE user_id = $1)`, [userBId]);
                await query(`DELETE FROM account_change_history WHERE user_id = $1`, [userBId]);
                await query(`DELETE FROM account_change_operations WHERE user_id = $1`, [userBId]);
                await query(`DELETE FROM email_verification_otps WHERE user_id = $1`, [userBId]);
                await query(`DELETE FROM users WHERE id = $1`, [userBId]);
            }
            console.log("[Cleanup] Cleaned up test accounts successfully.");
        } catch (cleanupErr) {
            console.error("[Cleanup Error]", cleanupErr);
        }

        console.log("\n================================================================================");
        console.log(`TOTAL TESTS EXECUTED: ${passed + failed}`);
        console.log(`PASSED: ${passed}`);
        console.log(`FAILED: ${failed}`);
        console.log("================================================================================\n");

        // Close pools so process exits cleanly
        try {
            await pool.end();
            redis.disconnect();
        } catch {}

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
}

runManageAccountsTests();
