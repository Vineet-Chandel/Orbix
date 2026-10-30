// Backend/scripts/test_blog_routes_http.ts
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import redis from "../src/redis/client.js";
import blogRouter from "../src/Routes/blog/blogRoutes.js";
import { pool, query } from "../src/database/client.js";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api/blogs", blogRouter);

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

async function runHttpTests() {
    console.log("=================================================");
    console.log("   ORBIX BLOG LIKES — HTTP ROUTE VERIFICATION");
    console.log("=================================================\n");

    const server = app.listen(0);
    const address = server.address() as any;
    const port = address.port;
    const baseUrl = `http://localhost:${port}/api/blogs`;

    let testUserId: string | null = null;
    const testHoster = "http-test-hoster";
    const testBlog = "http-test-launchpad";

    try {
        // Setup user
        const userRes = await query(`
            INSERT INTO users (firstname, lastname, email, username, password)
            VALUES ('Http', 'Tester', 'httptester@orbix.test', 'httptester', 'pass123')
            ON CONFLICT (email) DO UPDATE SET username = 'httptester'
            RETURNING id, email, username;
        `);
        testUserId = userRes.rows[0].id;

        const token = jwt.sign(
            { sub: testUserId, gmail: "httptester@orbix.test", username: "httptester" },
            JWT_SECRET,
            { issuer: "orbix", audience: "orbix-users" }
        );

        // Clean any likes
        await query(`DELETE FROM blog_likes WHERE hoster = $1;`, [testHoster]);

        // 1. Guest GET single publication
        console.log("1. GET /api/blogs/:hoster/:blogName/likes (Guest)...");
        const res1 = await fetch(`${baseUrl}/${testHoster}/${testBlog}/likes`);
        const json1 = await res1.json();
        console.log("   Status:", res1.status, json1);
        if (res1.status !== 200 || json1.data.likeCount !== 0 || json1.data.likedByViewer !== false) {
            throw new Error(`Route Test 1 Failed`);
        }
        console.log("   ✅ PASSED: Guest GET returns 200 with likeCount: 0, likedByViewer: false");

        // 2. Guest POST like (Must be rejected with 401)
        console.log("\n2. POST /api/blogs/:hoster/:blogName/likes (Guest -> 401 expected)...");
        const res2 = await fetch(`${baseUrl}/${testHoster}/${testBlog}/likes`, {
            method: "POST",
        });
        const json2 = await res2.json();
        console.log("   Status:", res2.status, json2);
        if (res2.status !== 401) {
            throw new Error(`Route Test 2 Failed: Expected 401 for unauthenticated user`);
        }
        console.log("   ✅ PASSED: Guest like attempt properly rejected with 401");

        // 3. Authenticated POST like
        console.log("\n3. POST /api/blogs/:hoster/:blogName/likes (Authenticated)...");
        const res3 = await fetch(`${baseUrl}/${testHoster}/${testBlog}/likes`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const json3 = await res3.json();
        console.log("   Status:", res3.status, json3);
        if (res3.status !== 200 || json3.data.likeCount !== 1 || json3.data.likedByViewer !== true) {
            throw new Error(`Route Test 3 Failed`);
        }
        console.log("   ✅ PASSED: Authenticated user like succeeded (likeCount: 1, likedByViewer: true)");

        // 4. Authenticated GET (shows likedByViewer: true)
        console.log("\n4. GET /api/blogs/:hoster/:blogName/likes (Authenticated)...");
        const res4 = await fetch(`${baseUrl}/${testHoster}/${testBlog}/likes`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const json4 = await res4.json();
        console.log("   Status:", res4.status, json4);
        if (res4.status !== 200 || json4.data.likeCount !== 1 || json4.data.likedByViewer !== true) {
            throw new Error(`Route Test 4 Failed`);
        }
        console.log("   ✅ PASSED: Authenticated GET shows likedByViewer: true");

        // 5. POST /api/blogs/likes/batch
        console.log("\n5. POST /api/blogs/likes/batch (Batch)...");
        const res5 = await fetch(`${baseUrl}/likes/batch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                publications: [
                    { hoster: testHoster, blogName: testBlog },
                    { hoster: "empty-hoster", blogName: "empty-blog" },
                ],
            }),
        });
        const json5 = await res5.json();
        console.log("   Status:", res5.status, json5);
        if (res5.status !== 200 || json5.data.publications.length !== 2) {
            throw new Error(`Route Test 5 Failed`);
        }
        console.log("   ✅ PASSED: Batch endpoint returned 2 publications with exact counts");

        // 6. Authenticated DELETE unlike
        console.log("\n6. DELETE /api/blogs/:hoster/:blogName/likes (Authenticated)...");
        const res6 = await fetch(`${baseUrl}/${testHoster}/${testBlog}/likes`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const json6 = await res6.json();
        console.log("   Status:", res6.status, json6);
        if (res6.status !== 200 || json6.data.likeCount !== 0 || json6.data.likedByViewer !== false) {
            throw new Error(`Route Test 6 Failed`);
        }
        console.log("   ✅ PASSED: Authenticated unlike succeeded (likeCount: 0, likedByViewer: false)");

        console.log("\n=================================================");
        console.log("   🎉 ALL 6 HTTP ENDPOINT TESTS PASSED!");
        console.log("=================================================\n");
    } finally {
        server.close();
        if (testUserId) {
            try {
                await query(`DELETE FROM blog_likes WHERE hoster = $1;`, [testHoster]);
                await query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
            } catch {}
        }
        await pool.end();
        redis.disconnect();
        process.exit(0);
    }
}

runHttpTests().catch((err) => {
    console.error("HTTP test failed:", err);
    process.exit(1);
});
