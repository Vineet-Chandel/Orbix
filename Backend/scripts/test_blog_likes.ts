// Backend/scripts/test_blog_likes.ts
import { pool, query } from "../src/database/client.js";
import {
    getPublicationLikeInfo,
    getBatchPublicationLikes,
    likePublication,
    unlikePublication,
    invalidatePublicationLikeCache,
} from "../src/services/blog/blogLikeService.js";

async function runTests() {
    console.log("=================================================");
    console.log("   ORBIX BLOG LIKES — BACKEND VERIFICATION");
    console.log("=================================================\n");

    const testHosterA = "test-hoster-aws";
    const testBlogA = "test-launchpad-2026";
    const testHosterB = "test-hoster-gcp";
    const testBlogB = "test-cloud-run";

    let testUser1Id: string | null = null;
    let testUser2Id: string | null = null;

    try {
        // Step 0: Create isolated test users
        console.log("1. Setting up test users...");
        const user1Res = await query(`
            INSERT INTO users (firstname, lastname, email, username, password)
            VALUES ('Test', 'LikerOne', 'test_liker_1@orbix.test', 'testliker1', 'hash123')
            ON CONFLICT (email) DO UPDATE SET username = 'testliker1'
            RETURNING id;
        `);
        testUser1Id = user1Res.rows[0].id;

        const user2Res = await query(`
            INSERT INTO users (firstname, lastname, email, username, password)
            VALUES ('Test', 'LikerTwo', 'test_liker_2@orbix.test', 'testliker2', 'hash123')
            ON CONFLICT (email) DO UPDATE SET username = 'testliker2'
            RETURNING id;
        `);
        testUser2Id = user2Res.rows[0].id;

        console.log(`   User 1 ID: ${testUser1Id}`);
        console.log(`   User 2 ID: ${testUser2Id}`);

        // Clean any existing test rows for test publications
        await query(`DELETE FROM blog_likes WHERE hoster IN ($1, $2);`, [testHosterA, testHosterB]);
        await invalidatePublicationLikeCache(testHosterA, testBlogA);
        await invalidatePublicationLikeCache(testHosterB, testBlogB);

        // Test 1: Guest retrieval on empty publication
        console.log("\n2. Testing Guest retrieval on empty publication...");
        const guestInitial = await getPublicationLikeInfo(testHosterA, testBlogA, null);
        console.log("   Result:", guestInitial);
        if (guestInitial.likeCount !== 0 || guestInitial.likedByViewer !== false) {
            throw new Error(`Test 1 Failed: Expected 0 likes and likedByViewer false, got ${JSON.stringify(guestInitial)}`);
        }
        console.log("   ✅ PASSED: Guest sees 0 likes and likedByViewer = false");

        // Test 2: User 1 Likes Publication A
        console.log("\n3. Testing User 1 Liking Publication A...");
        const likeRes1 = await likePublication(testHosterA, testBlogA, testUser1Id!);
        console.log("   Result:", likeRes1);
        if (likeRes1.likeCount !== 1 || likeRes1.likedByViewer !== true) {
            throw new Error(`Test 2 Failed: Expected 1 like and likedByViewer true, got ${JSON.stringify(likeRes1)}`);
        }
        console.log("   ✅ PASSED: User 1 liked Publication A (count = 1, likedByViewer = true)");

        // Test 3: Guest sees updated count, but likedByViewer is false
        console.log("\n4. Testing Guest view after User 1 liked...");
        const guestAfterLike = await getPublicationLikeInfo(testHosterA, testBlogA, null);
        if (guestAfterLike.likeCount !== 1 || guestAfterLike.likedByViewer !== false) {
            throw new Error(`Test 3 Failed: Guest should see count 1, likedByViewer false. Got ${JSON.stringify(guestAfterLike)}`);
        }
        console.log("   ✅ PASSED: Guest sees count = 1 and likedByViewer = false");

        // Test 4: Duplicate Like Idempotency (User 1 likes again)
        console.log("\n5. Testing Duplicate Like Idempotency (User 1 clicks again)...");
        const duplicateLike = await likePublication(testHosterA, testBlogA, testUser1Id!);
        if (duplicateLike.likeCount !== 1 || duplicateLike.likedByViewer !== true) {
            throw new Error(`Test 4 Failed: Count should remain 1. Got ${JSON.stringify(duplicateLike)}`);
        }
        const dbCountCheck = await query(`SELECT COUNT(*)::int as c FROM blog_likes WHERE hoster = $1 AND blog_name = $2;`, [testHosterA, testBlogA]);
        if (dbCountCheck.rows[0].c !== 1) {
            throw new Error(`Test 4 Failed: DB has ${dbCountCheck.rows[0].c} rows instead of exactly 1!`);
        }
        console.log("   ✅ PASSED: Duplicate like was safely ignored, count remained 1 (Idempotent)");

        // Test 5: User 2 also Likes Publication A
        console.log("\n6. Testing User 2 also Liking Publication A...");
        const likeRes2 = await likePublication(testHosterA, testBlogA, testUser2Id!);
        if (likeRes2.likeCount !== 2 || likeRes2.likedByViewer !== true) {
            throw new Error(`Test 5 Failed: Expected count 2. Got ${JSON.stringify(likeRes2)}`);
        }
        console.log("   ✅ PASSED: Two distinct users liked Publication A (count = 2)");

        // Test 6: Publication Independence (Publication B should remain 0)
        console.log("\n7. Testing Publication Independence...");
        const pubBInfo = await getPublicationLikeInfo(testHosterB, testBlogB, testUser1Id);
        if (pubBInfo.likeCount !== 0 || pubBInfo.likedByViewer !== false) {
            throw new Error(`Test 6 Failed: Publication B should have 0 likes. Got ${JSON.stringify(pubBInfo)}`);
        }
        console.log("   ✅ PASSED: Publication B has 0 likes, completely independent from Publication A");

        // Test 7: Batch Retrieval (Zero N+1)
        console.log("\n8. Testing Batch Retrieval...");
        const batchRes = await getBatchPublicationLikes(
            [
                { hoster: testHosterA, blogName: testBlogA },
                { hoster: testHosterB, blogName: testBlogB },
                { hoster: testHosterA, blogName: testBlogA }, // duplicate in request
            ],
            testUser1Id
        );
        console.log("   Batch Result:", batchRes);
        if (batchRes.length !== 2) {
            throw new Error(`Test 7 Failed: Expected 2 deduplicated results, got ${batchRes.length}`);
        }
        const pubAResult = batchRes.find((p) => p.hoster === testHosterA && p.blogName === testBlogA);
        const pubBResult = batchRes.find((p) => p.hoster === testHosterB && p.blogName === testBlogB);
        if (!pubAResult || pubAResult.likeCount !== 2 || pubAResult.likedByViewer !== true) {
            throw new Error(`Test 7 Failed: Pub A batch mismatch: ${JSON.stringify(pubAResult)}`);
        }
        if (!pubBResult || pubBResult.likeCount !== 0 || pubBResult.likedByViewer !== false) {
            throw new Error(`Test 7 Failed: Pub B batch mismatch: ${JSON.stringify(pubBResult)}`);
        }
        console.log("   ✅ PASSED: Batch retrieval returned exact metrics for multiple publications in 1 query");

        // Test 8: User 1 Unlikes Publication A
        console.log("\n9. Testing User 1 Unliking Publication A...");
        const unlikeRes1 = await unlikePublication(testHosterA, testBlogA, testUser1Id!);
        if (unlikeRes1.likeCount !== 1 || unlikeRes1.likedByViewer !== false) {
            throw new Error(`Test 8 Failed: Expected count 1 and likedByViewer false. Got ${JSON.stringify(unlikeRes1)}`);
        }
        console.log("   ✅ PASSED: User 1 unliked (count decremented to 1, User 1 likedByViewer = false)");

        // Test 9: User 2 still shows likedByViewer = true
        console.log("\n10. Testing User 2 view after User 1 unliked...");
        const user2View = await getPublicationLikeInfo(testHosterA, testBlogA, testUser2Id);
        if (user2View.likeCount !== 1 || user2View.likedByViewer !== true) {
            throw new Error(`Test 9 Failed: User 2 should still have likedByViewer = true. Got ${JSON.stringify(user2View)}`);
        }
        console.log("   ✅ PASSED: User 2's liked state is correctly preserved");

        // Test 10: Idempotent Unlike (User 1 unlikes again)
        console.log("\n11. Testing Repeated Unlike Idempotency...");
        const unlikeAgain = await unlikePublication(testHosterA, testBlogA, testUser1Id!);
        if (unlikeAgain.likeCount !== 1 || unlikeAgain.likedByViewer !== false) {
            throw new Error(`Test 10 Failed: Repeated unlike caused unexpected state: ${JSON.stringify(unlikeAgain)}`);
        }
        console.log("   ✅ PASSED: Repeated unlike is safely idempotent");

        // Test 11: Cascading deletion on user delete
        console.log("\n12. Testing Foreign Key ON DELETE CASCADE...");
        await query(`DELETE FROM users WHERE id = $1;`, [testUser2Id]);
        await invalidatePublicationLikeCache(testHosterA, testBlogA);
        const countAfterUserDelete = await getPublicationLikeInfo(testHosterA, testBlogA, null);
        if (countAfterUserDelete.likeCount !== 0) {
            throw new Error(`Test 11 Failed: Expected count 0 after user deletion, got ${countAfterUserDelete.likeCount}`);
        }
        console.log("   ✅ PASSED: Likes automatically purged when user was deleted (CASCADE)");

        console.log("\n=================================================");
        console.log("   🎉 ALL 11 BACKEND VERIFICATION TESTS PASSED!");
        console.log("=================================================\n");
    } finally {
        // Cleanup test data
        try {
            await query(`DELETE FROM blog_likes WHERE hoster IN ($1, $2);`, [testHosterA, testHosterB]);
            if (testUser1Id) await query(`DELETE FROM users WHERE id = $1;`, [testUser1Id]);
            if (testUser2Id) await query(`DELETE FROM users WHERE id = $1;`, [testUser2Id]);
            console.log("Cleanup completed.");
        } catch {
            // ignore cleanup errors
        }
        await pool.end();
    }
}

runTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
});
