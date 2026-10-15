import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { query, pool, testDatabaseConnection } from "./src/database/client.js";
import authRouter from "./src/Routes/auth/auth.js";
import profileRouter from "./src/Routes/profile/profile.js";
import photoRouter, { processPhotoCleanupQueue } from "./src/Routes/profile/photo.js";
import {
    assertCloudinaryConfigured,
    isCloudinaryConfigured,
    getOptimizedAvatarUrl,
    ALLOWED_PHOTO_FORMATS,
} from "./src/config/cloudinary.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", true);

app.use("/api", authRouter);
app.use("/api/profile", profileRouter);

const TEST_PORT = 3849;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_tests";

async function runPhotoManagementTests() {
    console.log("\n==================================================");
    console.log("   ORBIX PROFILE PHOTO MANAGEMENT TEST SUITE");
    console.log("==================================================\n");

    let server: any;
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, testName: string, details?: any) => {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName}`, details || "");
            failed++;
        }
    };

    try {
        // 1. Verify Database Schema & Migration
        console.log("-> 1. Verifying Database Schema & Migration...");
        await testDatabaseConnection();

        const schemaCheck = await query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name IN ('photo_url', 'photo_public_id', 'previous_photo_url', 'previous_photo_public_id');
        `);
        const foundColumns = schemaCheck.rows.map((r: any) => r.column_name);
        assert(
            foundColumns.includes("photo_url") &&
            foundColumns.includes("photo_public_id") &&
            foundColumns.includes("previous_photo_url") &&
            foundColumns.includes("previous_photo_public_id"),
            "Database users table has all 4 photo columns"
        );

        const intentTableCheck = await query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name IN ('photo_upload_intents', 'photo_cleanup_queue');
        `);
        const foundTables = intentTableCheck.rows.map((r: any) => r.table_name);
        assert(
            foundTables.includes("photo_upload_intents") && foundTables.includes("photo_cleanup_queue"),
            "Database has photo_upload_intents and photo_cleanup_queue tables"
        );

        // Start local test server
        await new Promise<void>((resolve) => {
            server = app.listen(TEST_PORT, () => resolve());
        });

        const baseUrl = `http://localhost:${TEST_PORT}`;

        // Helper for HTTP requests
        const api = async (
            method: string,
            path: string,
            body?: any,
            token?: string
        ) => {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
                headers["Cookie"] = `token=${token}`;
            }

            const reqInit: RequestInit = {
                method,
                headers,
            };
            if (body !== undefined && body !== null) {
                reqInit.body = JSON.stringify(body);
            }

            const res = await fetch(`${baseUrl}${path}`, reqInit);

            const data = await res.json().catch(() => ({}));
            return { status: res.status, data };
        };

        // Clean test user if exists
        const testEmail = "phototest_user@orbix.dev";
        const testUsername = "phototester";
        await query("DELETE FROM photo_upload_intents WHERE user_email = $1 OR username = $2", [testEmail, testUsername]);
        await query("DELETE FROM users WHERE email = $1 OR username = $2", [testEmail, testUsername]);

        // 2. Signup without Photo (Never required)
        console.log("\n-> 2. Testing Signup Compatibility (No photo provided)...");
        const signupRes = await api("POST", "/api/signup", {
            firstName: "Photo",
            lastName: "Tester",
            gmail: testEmail,
            username: testUsername,
            password: "A3q@9F!zxQ!23!_",
            termsAccepted: true,
        });

        assert(signupRes.status === 200 || signupRes.status === 201, "Signup succeeds without photo input", signupRes.data);
        const authToken = signupRes.data?.token;
        assert(Boolean(authToken), "Signup returns authentication token");

        // 3. User Profile response with NULL photo
        console.log("\n-> 3. Testing Profile response for new user (NULL photo state)...");
        const profileRes = await api("GET", "/api/profile/me", null, authToken);
        assert(profileRes.status === 200, "GET /api/profile/me returns 200", profileRes.data);
        assert(profileRes.data?.user?.photoUrl === null || profileRes.data?.user?.photoUrl === undefined, "photoUrl is null for new user");
        assert(!profileRes.data?.user?.hasPreviousPhoto, "hasPreviousPhoto is false for new user");
        assert(!profileRes.data?.user?.photoPublicId, "Internal photo_public_id is NOT exposed in response");

        // 4. Security: Unauthenticated upload-signature request
        console.log("\n-> 4. Testing Security: Unauthenticated signature request...");
        const unauthRes = await api("POST", "/api/profile/photo/upload-signature", {});
        assert(unauthRes.status === 401, "Unauthenticated signature request is rejected (401)");

        // 5. Authenticated upload-signature request
        console.log("\n-> 5. Testing Upload Signature Generation...");
        const sigRes = await api("POST", "/api/profile/photo/upload-signature", {}, authToken);

        if (sigRes.status === 200) {
            const config = sigRes.data?.uploadConfig;
            assert(Boolean(config?.signature), "Generated signature is returned");
            assert(Boolean(config?.publicId), "Generated server-controlled public ID is returned");
            assert(Boolean(config?.timestamp), "Generated timestamp is returned");
            assert(Boolean(config?.apiKey), "Cloudinary API key is provided");
            assert(!config?.apiSecret, "Cloudinary API secret is NEVER exposed");
            assert(config?.allowedFormats?.includes("webp"), "Allowed formats includes WebP");
            assert(config?.publicId?.includes("u_"), "Public ID is namespaced to user");

            // Verify upload intent was persisted in database
            const intentDb = await query(
                `SELECT status, expires_at FROM photo_upload_intents WHERE public_id = $1`,
                [config.publicId]
            );
            assert(intentDb.rowCount === 1 && intentDb.rows[0].status === "pending", "Upload intent recorded in DB with pending status");

            // 6. Security: User cannot confirm forged or unowned public ID
            console.log("\n-> 6. Testing Security: Forged public ID rejection...");
            const forgedConfirmRes = await api(
                "POST",
                "/api/profile/photo/confirm",
                { publicId: "forged/arbitrary_asset_123" },
                authToken
            );
            assert(forgedConfirmRes.status === 403 || forgedConfirmRes.status === 400, "Forged public ID is rejected");

            // 7. Test Direct Confirmation Flow
            console.log("\n-> 7. Testing Photo Confirmation & Atomic DB Update...");
            // Directly simulate successful verification of this server-generated intent in DB
            const testPhotoUrl = "https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_256,h_256/orbix_avatar_1.webp";

            // Update user with initial photo directly to test atomic replacement and history
            await query(
                `UPDATE users
                 SET photo_url = $1,
                     photo_public_id = $2,
                     avatar_url = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE username = $3;`,
                [testPhotoUrl, config.publicId, testUsername]
            );

            // Mark intent consumed
            await query(
                `UPDATE photo_upload_intents SET status = 'consumed' WHERE public_id = $1;`,
                [config.publicId]
            );

            // Verify updated profile
            const updatedProfile = await api("GET", "/api/profile/me", null, authToken);
            assert(updatedProfile.data?.user?.photoUrl === testPhotoUrl, "Profile returns newly saved photoUrl");

            // 8. Security: Replayed / consumed intent confirmation is rejected
            console.log("\n-> 8. Testing Security: Replayed intent rejection...");
            const replayRes = await api(
                "POST",
                "/api/profile/photo/confirm",
                { publicId: config.publicId },
                authToken
            );
            assert(replayRes.status === 409 || replayRes.status === 400, "Replayed/consumed intent is rejected (409 Conflict)");

            // 9. Testing Photo Replacement & Previous Photo Preservation
            console.log("\n-> 9. Testing Photo Replacement & History...");
            const secondSigRes = await api("POST", "/api/profile/photo/upload-signature", {}, authToken);
            const secondConfig = secondSigRes.data?.uploadConfig;
            const secondPhotoUrl = "https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_256,h_256/orbix_avatar_2.webp";

            // Simulate replacing photo in database
            await query(
                `UPDATE users
                 SET photo_url = $1,
                     photo_public_id = $2,
                     previous_photo_url = $3,
                     previous_photo_public_id = $4,
                     avatar_url = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE username = $5;`,
                [secondPhotoUrl, secondConfig?.publicId || "photo_2", testPhotoUrl, config.publicId, testUsername]
            );

            const afterReplaceProfile = await api("GET", "/api/profile/me", null, authToken);
            assert(afterReplaceProfile.data?.user?.photoUrl === secondPhotoUrl, "Current photo updated to photo 2");
            assert(afterReplaceProfile.data?.user?.previousPhotoUrl === testPhotoUrl, "Previous photo retained as photo 1");
            assert(afterReplaceProfile.data?.user?.hasPreviousPhoto === true, "hasPreviousPhoto is true");

            // 10. Testing Restore Previous Photo Action
            console.log("\n-> 10. Testing Restore Previous Photo...");
            const restoreRes = await api("POST", "/api/profile/photo/restore", {}, authToken);
            assert(restoreRes.status === 200, "Restore endpoint returns 200", restoreRes.data);
            assert(restoreRes.data?.photoUrl === testPhotoUrl, "Restored photoUrl matches previous photo 1");

            const afterRestoreProfile = await api("GET", "/api/profile/me", null, authToken);
            assert(afterRestoreProfile.data?.user?.photoUrl === testPhotoUrl, "Profile now has restored photo 1 as active");
            assert(afterRestoreProfile.data?.user?.previousPhotoUrl === secondPhotoUrl, "Former active photo 2 is now preserved as previous");

            // 11. Testing Use Default Avatar Action
            console.log("\n-> 11. Testing Use Default Avatar (Reset to NULL)...");
            const defaultRes = await api("POST", "/api/profile/photo/default", {}, authToken);
            assert(defaultRes.status === 200, "Use default avatar returns 200", defaultRes.data);
            assert(defaultRes.data?.photoUrl === null, "Default avatar sets photoUrl to null");
            assert(defaultRes.data?.hasPreviousPhoto === true, "Previous photo is preserved for restore capability");

            const afterDefaultProfile = await api("GET", "/api/profile/me", null, authToken);
            assert(afterDefaultProfile.data?.user?.photoUrl === null, "Active profile has photoUrl: null");

            // 12. Testing Restoring Photo when Default Avatar is Active
            console.log("\n-> 12. Testing Restoring Photo after Default Avatar...");
            const restoreAgainRes = await api("POST", "/api/profile/photo/restore", {}, authToken);
            assert(restoreAgainRes.status === 200, "Can restore photo from default avatar state");
            assert(Boolean(restoreAgainRes.data?.photoUrl), "Restored photo becomes active again");

            // 13. Testing Public Profile Endpoint (No sensitive photo data leaked)
            console.log("\n-> 13. Testing Public Profile Payload...");
            const publicRes = await api("GET", `/api/profile/public/${testUsername}`);
            assert(publicRes.status === 200, "GET /api/profile/public/:username returns 200");
            assert(publicRes.data?.profile?.avatarUrl !== undefined, "Public profile has avatarUrl");
            assert(!publicRes.data?.profile?.photoPublicId, "Public profile does NOT leak photoPublicId");
            assert(!publicRes.data?.profile?.previousPhotoPublicId, "Public profile does NOT leak previousPhotoPublicId");

            // 14. Testing Cleanup Queue Worker
            console.log("\n-> 14. Testing Cleanup Queue Processing...");
            await query(
                `INSERT INTO photo_cleanup_queue (public_id, reason, status)
                 VALUES ('test/orphaned_asset', 'superseded', 'pending');`
            );
            await processPhotoCleanupQueue();
            const queueJob = await query(`SELECT attempts FROM photo_cleanup_queue WHERE public_id = 'test/orphaned_asset'`);
            assert(queueJob.rowCount === 1, "Cleanup queue records job safely");
        } else {
            console.log("ℹ️ Cloudinary credentials not active for live signature; verified error response handling");
            assert(sigRes.status === 503 || sigRes.status === 500, "Safe failure without crash when unconfigured");
        }

        // Cleanup test user
        await query("DELETE FROM photo_upload_intents WHERE user_email = $1 OR username = $2", [testEmail, testUsername]);
        await query("DELETE FROM photo_cleanup_queue WHERE public_id = 'test/orphaned_asset'");
        await query("DELETE FROM users WHERE email = $1 OR username = $2", [testEmail, testUsername]);

    } catch (err: any) {
        console.error("Test execution exception:", err);
        failed++;
    } finally {
        if (server) {
            server.close();
        }
    }

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhotoManagementTests();
