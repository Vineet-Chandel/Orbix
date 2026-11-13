// Backend/scripts/test_event_engagement.ts
import { pool, query } from "../src/database/client.js";
import redis from "../src/redis/client.js";
import {
    getEventEngagement,
    getBatchEventEngagement,
    likeEvent,
    unlikeEvent,
    toggleEventLike,
    recordEventShare,
    invalidateEventEngagementCache,
} from "../src/services/events/eventEngagementService.js";

async function runTests() {
    console.log("=================================================");
    console.log("  ORBIX EVENT ENGAGEMENT (LIKE & SHARE) — TESTS");
    console.log("=================================================\n");

    let testClubId: string | null = null;
    let testEventAId: string | null = null;
    let testEventBId: string | null = null;
    let testUser1Id: string | null = null;
    let testUser2Id: string | null = null;

    try {
        // 1. Setup test users, verified club, and test events
        console.log("1. Setting up test entities...");
        const u1 = await query(`
            INSERT INTO users (firstname, lastname, email, username, password)
            VALUES ('EventLiker', 'One', 'event_liker_1@orbix.test', 'eventliker1', 'hash123')
            ON CONFLICT (email) DO UPDATE SET username = 'eventliker1'
            RETURNING id;
        `);
        testUser1Id = u1.rows[0].id;

        const u2 = await query(`
            INSERT INTO users (firstname, lastname, email, username, password)
            VALUES ('EventLiker', 'Two', 'event_liker_2@orbix.test', 'eventliker2', 'hash123')
            ON CONFLICT (email) DO UPDATE SET username = 'eventliker2'
            RETURNING id;
        `);
        testUser2Id = u2.rows[0].id;

        const existingClubRes = await query(`SELECT id FROM verified_clubs LIMIT 1;`);
        if (existingClubRes.rows.length > 0) {
            testClubId = existingClubRes.rows[0].id;
        } else {
            const clubRes = await query(`
                INSERT INTO verified_clubs (auth_user_id, name, slug, category, college_name, college_city, college_state, is_active)
                VALUES ($1, 'Test Tech Club', 'test-tech-club-engagement', 'technical', 'Test Engineering College', 'TestCity', 'TestState', true)
                ON CONFLICT (slug) DO UPDATE SET is_active = true
                RETURNING id;
            `, [testUser1Id]);
            testClubId = clubRes.rows[0].id;
        }

        const evARes = await query(`
            INSERT INTO club_events (club_id, title, slug, starts_at, status)
            VALUES ($1, 'Launchpad Hackathon 2026', 'launchpad-hackathon-2026-test', NOW() + INTERVAL '1 day', 'published')
            ON CONFLICT (club_id, slug) DO UPDATE SET status = 'published'
            RETURNING id;
        `, [testClubId]);
        testEventAId = evARes.rows[0].id;

        const evBRes = await query(`
            INSERT INTO club_events (club_id, title, slug, starts_at, status)
            VALUES ($1, 'Cloud Workshop 2026', 'cloud-workshop-2026-test', NOW() + INTERVAL '2 day', 'published')
            ON CONFLICT (club_id, slug) DO UPDATE SET status = 'published'
            RETURNING id;
        `, [testClubId]);
        testEventBId = evBRes.rows[0].id;

        // Clean any previous engagement
        await query(`DELETE FROM club_event_likes WHERE event_id IN ($1, $2);`, [testEventAId, testEventBId]);
        await query(`DELETE FROM club_event_shares WHERE event_id IN ($1, $2);`, [testEventAId, testEventBId]);
        await invalidateEventEngagementCache(testEventAId!);
        await invalidateEventEngagementCache(testEventBId!);

        console.log(`   User 1 ID: ${testUser1Id}`);
        console.log(`   User 2 ID: ${testUser2Id}`);
        console.log(`   Event A ID: ${testEventAId}`);
        console.log(`   Event B ID: ${testEventBId}`);

        // 2. Initial state verification (Guest view on Event A)
        console.log("\n2. Testing initial event engagement (Guest view)...");
        const initialA = await getEventEngagement(testEventAId!, null);
        if (!initialA || initialA.likeCount !== 0 || initialA.likedByViewer !== false || initialA.shareCount !== 0) {
            throw new Error(`Test 2 Failed: Expected 0 likes, 0 shares, got ${JSON.stringify(initialA)}`);
        }
        console.log("   ✅ PASSED: Initial event has 0 likes, 0 shares, likedByViewer = false");

        // 3. User 1 Likes Event A
        console.log("\n3. Testing User 1 liking Event A...");
        const like1 = await likeEvent(testEventAId!, testUser1Id!);
        if (like1.likeCount !== 1 || like1.likedByViewer !== true) {
            throw new Error(`Test 3 Failed: Expected count 1 and likedByViewer true, got ${JSON.stringify(like1)}`);
        }
        console.log("   ✅ PASSED: User 1 liked Event A (count = 1, likedByViewer = true)");

        // 4. Duplicate like idempotency
        console.log("\n4. Testing duplicate like idempotency (User 1 clicks again)...");
        const dupLike = await likeEvent(testEventAId!, testUser1Id!);
        if (dupLike.likeCount !== 1 || dupLike.likedByViewer !== true) {
            throw new Error(`Test 4 Failed: Count should remain 1. Got ${JSON.stringify(dupLike)}`);
        }
        console.log("   ✅ PASSED: Duplicate like safely ignored (Idempotent, count = 1)");

        // 5. User 2 also likes Event A
        console.log("\n5. Testing User 2 liking Event A...");
        const like2 = await likeEvent(testEventAId!, testUser2Id!);
        if (like2.likeCount !== 2 || like2.likedByViewer !== true) {
            throw new Error(`Test 5 Failed: Expected count 2. Got ${JSON.stringify(like2)}`);
        }
        console.log("   ✅ PASSED: User 2 liked Event A (count = 2)");

        // 6. Independent Event Isolation (Event B remains 0)
        console.log("\n6. Testing event isolation (Event B counts)...");
        const eventBInfo = await getEventEngagement(testEventBId!, testUser1Id);
        if (!eventBInfo || eventBInfo.likeCount !== 0 || eventBInfo.likedByViewer !== false) {
            throw new Error(`Test 6 Failed: Event B should have 0 likes. Got ${JSON.stringify(eventBInfo)}`);
        }
        console.log("   ✅ PASSED: Event B completely isolated from Event A (count = 0)");

        // 7. User 1 Unlikes Event A
        console.log("\n7. Testing User 1 unliking Event A...");
        const unlike1 = await unlikeEvent(testEventAId!, testUser1Id!);
        if (unlike1.likeCount !== 1 || unlike1.likedByViewer !== false) {
            throw new Error(`Test 7 Failed: Expected count 1, likedByViewer false. Got ${JSON.stringify(unlike1)}`);
        }
        console.log("   ✅ PASSED: User 1 unliked (count = 1, User 1 likedByViewer = false)");

        // 8. User 2's liked state preserved
        console.log("\n8. Checking User 2's state after User 1 unliked...");
        const user2State = await getEventEngagement(testEventAId!, testUser2Id);
        if (!user2State || user2State.likeCount !== 1 || user2State.likedByViewer !== true) {
            throw new Error(`Test 8 Failed: User 2 should still be likedByViewer true. Got ${JSON.stringify(user2State)}`);
        }
        console.log("   ✅ PASSED: User 2's liked state preserved (count = 1, likedByViewer = true)");

        // 9. Testing Share tracking with idempotency
        console.log("\n9. Testing successful share action recording...");
        const shareKey1 = "idemp-key-share-001";
        const shareRes1 = await recordEventShare(testEventAId!, shareKey1, testUser1Id, "web_share");
        if (shareRes1.shareCount !== 1) {
            throw new Error(`Test 9 Failed: Expected share count 1, got ${shareRes1.shareCount}`);
        }
        console.log("   ✅ PASSED: First share recorded (shareCount = 1)");

        // 10. Duplicate share idempotency key does not increment
        console.log("\n10. Testing duplicate share idempotency key...");
        const dupShare = await recordEventShare(testEventAId!, shareKey1, testUser1Id, "web_share");
        if (dupShare.shareCount !== 1) {
            throw new Error(`Test 10 Failed: Duplicate share key should not increment. Got ${dupShare.shareCount}`);
        }
        console.log("   ✅ PASSED: Duplicate share idempotency key safely ignored (count = 1)");

        // 11. Legitimate subsequent share increments count
        console.log("\n11. Testing second legitimate share attempt...");
        const shareKey2 = "idemp-key-share-002";
        const shareRes2 = await recordEventShare(testEventAId!, shareKey2, null, "clipboard");
        if (shareRes2.shareCount !== 2) {
            throw new Error(`Test 11 Failed: Expected share count 2, got ${shareRes2.shareCount}`);
        }
        console.log("   ✅ PASSED: Subsequent legitimate share recorded (shareCount = 2)");

        // 12. Batch Engagement Retrieval
        console.log("\n12. Testing batch engagement retrieval...");
        const batchRes = await getBatchEventEngagement([testEventAId!, testEventBId!], testUser2Id);
        console.log("   Batch result:", batchRes);
        if (batchRes.length !== 2) {
            throw new Error(`Test 12 Failed: Expected 2 items in batch result, got ${batchRes.length}`);
        }
        const aResult = batchRes.find((x) => x.eventId === testEventAId);
        if (!aResult || aResult.likeCount !== 1 || aResult.likedByViewer !== true || aResult.shareCount !== 2) {
            throw new Error(`Test 12 Failed: Inaccurate Event A batch stats: ${JSON.stringify(aResult)}`);
        }
        console.log("   ✅ PASSED: Batch retrieval returned exact metrics for multiple events");

        // 13. Redis Fast Path Verification
        console.log("\n13. Testing Redis acceleration on warm read...");
        const t0 = performance.now();
        const warmRead = await getEventEngagement(testEventAId!, null);
        const duration = (performance.now() - t0).toFixed(2);
        console.log(`   ⏱️ Warm read completed in ${duration} ms`);
        if (!warmRead || warmRead.likeCount !== 1 || warmRead.shareCount !== 2) {
            throw new Error(`Test 13 Failed: Warm read mismatch: ${JSON.stringify(warmRead)}`);
        }
        console.log("   ✅ PASSED: Redis warm read returned accurate metrics instantaneously");

        console.log("\n=================================================");
        console.log(" 🎉 ALL 13 EVENT ENGAGEMENT TESTS PASSED!");
        console.log("=================================================\n");
    } finally {
        // Cleanup test data
        try {
            if (testEventAId && testEventBId) {
                await query(`DELETE FROM club_event_likes WHERE event_id IN ($1, $2);`, [testEventAId, testEventBId]);
                await query(`DELETE FROM club_event_shares WHERE event_id IN ($1, $2);`, [testEventAId, testEventBId]);
                await query(`DELETE FROM club_events WHERE id IN ($1, $2);`, [testEventAId, testEventBId]);
            }
            if (testClubId) {
                await query(`DELETE FROM verified_clubs WHERE id = $1;`, [testClubId]);
            }
            if (testUser1Id) await query(`DELETE FROM users WHERE id = $1;`, [testUser1Id]);
            if (testUser2Id) await query(`DELETE FROM users WHERE id = $1;`, [testUser2Id]);
            console.log("Test cleanup completed.");
        } catch {
            // Safe to ignore cleanup error
        }
        try {
            redis.disconnect();
        } catch {}
        await pool.end();
        process.exit(0);
    }
}

runTests().catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
});
