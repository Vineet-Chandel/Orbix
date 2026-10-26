// Backend/test_relationships_pipeline.ts
import 'dotenv/config';
import { query, pool } from "./src/database/client.js";
import {
    getCanonicalPair,
    resolveRelationshipState,
    requestConnection,
    acceptConnection,
    declineConnection,
    cancelConnection,
    removeConnection,
    getUserConnections,
} from "./src/services/relationship/relationshipService.js";
import {
    blockUser,
    unblockUser,
    getBlockState,
    getBlockedUsers,
} from "./src/services/relationship/blockService.js";
import {
    checkNotificationQuota,
    dispatchNotification,
    MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H,
} from "./src/services/notification/quotaService.js";

async function runAllTests() {
    console.log("================================================================================");
    console.log("STARTING TEST SUITE: PRODUCTION-GRADE RELATIONSHIPS, BLOCKING & NOTIFICATIONS");
    console.log("================================================================================\n");

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition: boolean, desc: string) {
        if (condition) {
            console.log(`✅ PASS: ${desc}`);
            passedTests++;
        } else {
            console.error(`❌ FAIL: ${desc}`);
            failedTests++;
        }
    }

    // Step 0: Create dedicated test users
    console.log("--- Setup: Creating Test Fixtures ---");
    const userA_email = `test_user_a_${Date.now()}@orbix.dev`;
    const userB_email = `test_user_b_${Date.now()}@orbix.dev`;
    const userC_email = `test_user_c_${Date.now()}@orbix.dev`;

    const userARes = await query(
        `INSERT INTO users (username, email, firstname, lastname, password, termsaccepted)
         VALUES ($1, $2, 'Alice', 'Tester', 'hashedpass', true)
         RETURNING id, username;`,
        [`alice_${Date.now().toString().slice(-6)}`, userA_email]
    );
    const userBRes = await query(
        `INSERT INTO users (username, email, firstname, lastname, password, termsaccepted)
         VALUES ($1, $2, 'Bob', 'Tester', 'hashedpass', true)
         RETURNING id, username;`,
        [`bob_${Date.now().toString().slice(-6)}`, userB_email]
    );
    const userCRes = await query(
        `INSERT INTO users (username, email, firstname, lastname, password, termsaccepted)
         VALUES ($1, $2, 'Charlie', 'Tester', 'hashedpass', true)
         RETURNING id, username;`,
        [`charlie_${Date.now().toString().slice(-6)}`, userC_email]
    );

    const userA = userARes.rows[0];
    const userB = userBRes.rows[0];
    const userC = userCRes.rows[0];

    console.log(`Created fixtures: User A (${userA.username}), User B (${userB.username}), User C (${userC.username})\n`);

    try {
        // SCENARIO 1: A can request B successfully
        console.log("--- Scenario 1: A requests B ---");
        const req1 = await requestConnection(userA.id, userB.id, {
            username: userA.username,
            firstName: "Alice",
        });
        assert(req1.success && req1.outcome === "request_sent" && req1.state === "outgoing_pending", "A requests B returns request_sent and outgoing_pending");

        // Verify state for both users
        const stateA1 = await resolveRelationshipState(userA.id, userB.id);
        const stateB1 = await resolveRelationshipState(userB.id, userA.id);
        assert(stateA1.state === "outgoing_pending" && stateA1.canCancel === true, "A resolves state as outgoing_pending with canCancel=true");
        assert(stateB1.state === "incoming_pending" && stateB1.canAccept === true && stateB1.canDecline === true, "B resolves state as incoming_pending with canAccept=true and canDecline=true");

        // SCENARIO 2: A cannot create another active request to B
        console.log("\n--- Scenario 2: Duplicate request prevention ---");
        const reqDuplicate = await requestConnection(userA.id, userB.id);
        assert(reqDuplicate.success && reqDuplicate.outcome === "already_pending", "Duplicate request from A returns already_pending without error");

        // SCENARIO 4: Reciprocal request prevention (B tries to request A while A's request is pending)
        console.log("\n--- Scenario 4: Reciprocal request attempt by B ---");
        const reqReciprocal = await requestConnection(userB.id, userA.id);
        assert(reqReciprocal.success && reqReciprocal.outcome === "incoming_request_exists" && reqReciprocal.state === "incoming_pending",
            "B requesting A detects existing incoming request and does not create duplicate relationship");

        // Verify only 1 relationship row exists in DB
        const canonical = getCanonicalPair(userA.id, userB.id);
        const rowsCount = await query(
            `SELECT count(*) FROM user_relationships WHERE user_low_id = $1 AND user_high_id = $2;`,
            [canonical.userLowId, canonical.userHighId]
        );
        assert(parseInt(rowsCount.rows[0].count) === 1, "Exactly 1 canonical relationship row exists between A and B");

        // SCENARIO 5: Only recipient can accept (requester A cannot accept their own request)
        console.log("\n--- Scenario 5: Authorization checks on Accept/Decline ---");
        const invalidAccept = await acceptConnection(userA.id, userB.id);
        assert(!invalidAccept.success && invalidAccept.outcome === "unauthorized", "Requester A is rejected when attempting to accept own request");

        const invalidDecline = await declineConnection(userA.id, userB.id);
        assert(!invalidDecline.success && invalidDecline.outcome === "unauthorized", "Requester A is rejected when attempting to decline own request");

        // SCENARIO 6: Concurrency safety (Simultaneous requests)
        console.log("\n--- Scenario 6: Concurrent simultaneous requests ---");
        // Create pair between B and C
        const concurrentResults = await Promise.all([
            requestConnection(userB.id, userC.id),
            requestConnection(userC.id, userB.id),
            requestConnection(userB.id, userC.id),
            requestConnection(userC.id, userB.id),
        ]);
        const successes = concurrentResults.filter(r => r.success);
        assert(successes.length === 4, "All 4 concurrent requests resolve gracefully without throwing unhandled exceptions");
        const canonicalBC = getCanonicalPair(userB.id, userC.id);
        const rowsBC = await query(
            `SELECT count(*) FROM user_relationships WHERE user_low_id = $1 AND user_high_id = $2;`,
            [canonicalBC.userLowId, canonicalBC.userHighId]
        );
        assert(parseInt(rowsBC.rows[0].count) === 1, "Concurrency safety: exactly 1 canonical relationship row created between B and C");

        // SCENARIO 7 & 8: B accepts A's request, repeated acceptance does not duplicate
        console.log("\n--- Scenario 7 & 8: B accepts A's request ---");
        const acceptRes = await acceptConnection(userB.id, userA.id, {
            username: userB.username,
            firstName: "Bob",
        });
        assert(acceptRes.success && acceptRes.state === "connected", "B accepts A's request successfully");

        const stateA_connected = await resolveRelationshipState(userA.id, userB.id);
        const stateB_connected = await resolveRelationshipState(userB.id, userA.id);
        assert(stateA_connected.state === "connected" && stateA_connected.canRemove === true, "A sees connected state");
        assert(stateB_connected.state === "connected" && stateB_connected.canRemove === true, "B sees connected state");

        // Repeated acceptance
        const repeatedAccept = await acceptConnection(userB.id, userA.id);
        assert(repeatedAccept.success && repeatedAccept.outcome === "already_connected", "Repeated acceptance returns already_connected without error");

        // Verify notifications count for acceptance (idempotency)
        const acceptanceNotifs = await query(
            `SELECT count(*) FROM user_notifications WHERE relationship_id = $1 AND notification_type = 'connection_accepted';`,
            [acceptRes.relationshipId]
        );
        assert(parseInt(acceptanceNotifs.rows[0].count) === 1, "Idempotent acceptance: exactly 1 acceptance notification created");

        // SCENARIO 9: Removing a connection
        console.log("\n--- Scenario 9: Remove connection ---");
        const removeRes = await removeConnection(userA.id, userB.id);
        assert(removeRes.success && removeRes.state === "none", "A removes connection successfully");
        const stateA_removed = await resolveRelationshipState(userA.id, userB.id);
        assert(stateA_removed.state === "none" && stateA_removed.canRequest === true, "State resets to none after connection removal");

        // Reconnect A and B for block tests
        await requestConnection(userA.id, userB.id);
        await acceptConnection(userB.id, userA.id);

        // SCENARIO 10 & 11: Blocking ends existing connection and invalidates pending requests
        console.log("\n--- Scenario 10 & 11: Blocking ends connection ---");
        await blockUser(userA.id, userB.id, "Testing block");
        const blockStateA = await getBlockState(userA.id, userB.id);
        const blockStateB = await getBlockState(userB.id, userA.id);
        assert(blockStateA.isBlocked && blockStateA.blockState === "blocked_by_me", "A has blocked_by_me");
        assert(blockStateB.isBlocked && blockStateB.blockState === "blocked_by_them", "B has blocked_by_them");

        const relStateAfterBlockA = await resolveRelationshipState(userA.id, userB.id);
        const relStateAfterBlockB = await resolveRelationshipState(userB.id, userA.id);
        assert(relStateAfterBlockA.state === "blocked_by_me" && !relStateAfterBlockA.canRequest, "A cannot request while blocking");
        assert(relStateAfterBlockB.state === "blocked_by_them" && !relStateAfterBlockB.canRequest, "B cannot request while blocked");

        // Direct request attempt while blocked must fail
        const blockedReqAttempt = await requestConnection(userB.id, userA.id);
        assert(!blockedReqAttempt.success && blockedReqAttempt.outcome === "blocked", "Blocked user cannot request connection");

        // SCENARIO 12: Unblocking does NOT restore old connection
        console.log("\n--- Scenario 12: Unblocking semantics ---");
        await unblockUser(userA.id, userB.id);
        const stateAfterUnblockA = await resolveRelationshipState(userA.id, userB.id);
        assert(stateAfterUnblockA.state === "none" && stateAfterUnblockA.canRequest === true, "Unblocking returns state to 'none', does NOT restore old connection");

        // SCENARIO 14 & 15: Notification Sliding Window Rate Limit (3 per 24h)
        console.log("\n--- Scenario 14 & 15: Notification Rate Limit (3 per 24h rolling) ---");
        // First establish connection between A and B so notifications are permitted
        await requestConnection(userA.id, userB.id);
        await acceptConnection(userB.id, userA.id);

        const notif1 = await dispatchNotification({
            recipientId: userB.id,
            actorId: userA.id,
            title: "Ping 1",
            body: "First message",
            notificationType: "user_ping",
            isUserInitiated: true,
        });
        const notif2 = await dispatchNotification({
            recipientId: userB.id,
            actorId: userA.id,
            title: "Ping 2",
            body: "Second message",
            notificationType: "user_ping",
            isUserInitiated: true,
        });
        const notif3 = await dispatchNotification({
            recipientId: userB.id,
            actorId: userA.id,
            title: "Ping 3",
            body: "Third message",
            notificationType: "user_ping",
            isUserInitiated: true,
        });

        assert(notif1.success && notif2.success && notif3.success, "First 3 user-initiated notifications succeed");

        // 4th notification within window MUST be rejected with NOTIFICATION_LIMIT_REACHED
        const notif4 = await dispatchNotification({
            recipientId: userB.id,
            actorId: userA.id,
            title: "Ping 4",
            body: "Fourth message",
            notificationType: "user_ping",
            isUserInitiated: true,
        });

        assert(!notif4.success && notif4.code === "NOTIFICATION_LIMIT_REACHED", "4th notification is rejected with NOTIFICATION_LIMIT_REACHED");
        assert(typeof notif4.retryAfterSeconds === "number" && notif4.retryAfterSeconds > 0, `Retry-after is provided: ${notif4.retryAfterSeconds}s`);

        // Concurrent notification race condition test: 5 concurrent attempts to userC
        console.log("\n--- Scenario 15b: Concurrency race condition on notification limit ---");
        const concurrentNotifs = await Promise.all([
            dispatchNotification({ recipientId: userC.id, actorId: userA.id, title: "Race 1", body: "m1", notificationType: "user_ping", isUserInitiated: true }),
            dispatchNotification({ recipientId: userC.id, actorId: userA.id, title: "Race 2", body: "m2", notificationType: "user_ping", isUserInitiated: true }),
            dispatchNotification({ recipientId: userC.id, actorId: userA.id, title: "Race 3", body: "m3", notificationType: "user_ping", isUserInitiated: true }),
            dispatchNotification({ recipientId: userC.id, actorId: userA.id, title: "Race 4", body: "m4", notificationType: "user_ping", isUserInitiated: true }),
            dispatchNotification({ recipientId: userC.id, actorId: userA.id, title: "Race 5", body: "m5", notificationType: "user_ping", isUserInitiated: true }),
        ]);

        const successfulDeliveries = concurrentNotifs.filter(n => n.success);
        const rejectedDeliveries = concurrentNotifs.filter(n => !n.success && n.code === "NOTIFICATION_LIMIT_REACHED");
        assert(successfulDeliveries.length === 3, `Concurrent safety: exactly 3 of 5 succeeded (got ${successfulDeliveries.length})`);
        assert(rejectedDeliveries.length === 2, `Concurrent safety: exactly 2 of 5 rejected with limit (got ${rejectedDeliveries.length})`);

        // SCENARIO 17: Different recipients have independent quotas
        console.log("\n--- Scenario 17: Independent quotas per recipient ---");
        // A has exhausted quota to B (3 sent) and to C (3 sent).
        // Let B send to A: should have full 3 slots!
        const bQuota = await checkNotificationQuota(userB.id, userA.id);
        assert(bQuota.allowed && bQuota.remainingQuota === 3, "B to A has full independent quota of 3");

        // SCENARIO 18: Idempotent retries do not consume quota
        console.log("\n--- Scenario 18: Idempotent retries ---");
        const idemKey = `unique-idem-key-${Date.now()}`;
        const idem1 = await dispatchNotification({
            recipientId: userA.id,
            actorId: userB.id,
            title: "Idempotent ping",
            body: "Original",
            notificationType: "user_ping",
            idempotencyKey: idemKey,
            isUserInitiated: true,
        });
        const idem2 = await dispatchNotification({
            recipientId: userA.id,
            actorId: userB.id,
            title: "Idempotent ping duplicate",
            body: "Duplicate",
            notificationType: "user_ping",
            idempotencyKey: idemKey,
            isUserInitiated: true,
        });
        assert(idem1.success && idem2.success && idem1.notification.id === idem2.notification.id,
            "Idempotent retry returns identical notification without duplicate creation");

        // SCENARIO 19: Self-connection and invalid IDs rejected
        console.log("\n--- Scenario 19: Boundary validations ---");
        const selfReq = await requestConnection(userA.id, userA.id);
        assert(!selfReq.success && selfReq.outcome === "self_connection_rejected", "Self connection is safely rejected");

        const invalidTargetReq = await requestConnection(userA.id, "00000000-0000-0000-0000-000000000000");
        assert(!invalidTargetReq.success && invalidTargetReq.outcome === "user_not_found", "Non-existent user is safely rejected");

        // SCENARIO 20: Settings pagination & list queries
        console.log("\n--- Scenario 20: Settings pagination & list queries ---");
        const connectionsA = await getUserConnections(userA.id, 10);
        assert(connectionsA.connections.length >= 1, "User connections list retrieved with valid schema");
        assert(typeof connectionsA.totalCount === "number", "User connections count is a valid number");

        // Block C and check blocked list
        await blockUser(userA.id, userC.id, "Harassment");
        const blockedListA = await getBlockedUsers(userA.id, 10);
        assert(blockedListA.blockedUsers.length >= 1 && blockedListA.blockedUsers.some(b => b.blockedId === userC.id),
            "Blocked users list in Settings accurately shows blocked accounts");

    } finally {
        // Cleanup test fixtures
        console.log("\n--- Teardown: Cleaning Test Fixtures ---");
        await query(`DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1;`, [userA.id]);
        await query(`DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1;`, [userB.id]);
        await query(`DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1;`, [userC.id]);
        await query(`DELETE FROM user_relationships WHERE user_low_id IN ($1, $2, $3) OR user_high_id IN ($1, $2, $3);`, [userA.id, userB.id, userC.id]);
        await query(`DELETE FROM user_notifications WHERE actor_id IN ($1, $2, $3) OR recipient_id IN ($1, $2, $3);`, [userA.id, userB.id, userC.id]);
        await query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [userA.id, userB.id, userC.id]);
        console.log("Cleanup complete.");
    }

    console.log("\n================================================================================");
    console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("================================================================================");

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAllTests().catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
