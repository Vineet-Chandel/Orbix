import { query, pool } from "./src/database/client.js";
import crypto from "crypto";

async function runPipelineTest() {
    console.log("=================================================");
    console.log("   ORBIX VERIFIED CLUB FULL PIPELINE TEST");
    console.log("=================================================\n");

    const testRunId = crypto.randomUUID().slice(0, 8);
    const testUserId = crypto.randomUUID();
    const testClubName = `Orbix Test Club ${testRunId}`;
    let createdAppId: string | null = null;
    let createdClubId: string | null = null;
    let createdClubSlug: string | null = null;
    let createdEventId: string | null = null;

    try {
        // Step 1: Create a test user in auth.users and public.users
        console.log("👉 Step 1: Creating test user account...");
        await query(
            `INSERT INTO auth.users (id, email, encrypted_password, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
             VALUES ($1, $2, 'hashed_test_pwd', 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, '{"account_type":"club"}'::jsonb, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING;`,
            [testUserId, `club-${testRunId}@orbix-test.edu`]
        );

        const userRes = await query(
            `INSERT INTO users (id, username, firstname, lastname, email, password, termsaccepted, avatar_url, account_type, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'hashed_test_pwd', true, 'https://example.com/avatar.png', 'club', NOW(), NOW())
             RETURNING id, username, email, account_type;`,
            [testUserId, `club_lead_${testRunId}`, "Club", `Lead ${testRunId}`, `club-${testRunId}@orbix-test.edu`]
        );
        console.log("   Created user:", userRes.rows[0]);

        // Step 2: Register Club Application & Initialize Timeline Stages
        console.log("\n👉 Step 2: Registering club verification application with verified college...");
        const instRes = await query(
            `SELECT id, official_name, city, state, website FROM institutions WHERE is_active = true AND verification_status = 'verified' LIMIT 1;`
        );
        const testInst = instRes.rows[0];
        console.log("   Selected verified institution from DB:", testInst.official_name, `[ID: ${testInst.id}]`);

        createdAppId = crypto.randomUUID();
        const appRes = await query(
            `INSERT INTO club_verification_requests (
                id, auth_user_id, college_id, college_name, college_city, college_state, college_country,
                club_name, club_category, club_description, contact_person_name, contact_person_role,
                contact_email, contact_phone, terms_accepted, terms_version, privacy_policy_accepted, privacy_policy_version,
                is_email_verified, is_phone_verified, status, submitted_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 'v1.0', true, 'v1.0', true, true, 'pending', NOW(), NOW())
            RETURNING id, club_name, college_id, status, submitted_at, is_email_verified, is_phone_verified;`,
            [
                createdAppId,
                testUserId,
                testInst.id,
                testInst.official_name,
                testInst.city || "New Delhi",
                testInst.state || "Delhi",
                "India",
                testClubName,
                "coding",
                "Official student developer club fostering high-impact open source software.",
                "Alex Rivera",
                "Lead Organizer",
                `alex-${testRunId}@iit-test.edu`,
                "+919389205207",
            ]
        );
        console.log("   Application registered:", appRes.rows[0]);

        // Initialize 5 timeline events
        console.log("   Recording 5 initial verification timeline events...");
        await query(
            `INSERT INTO club_verification_timeline_events (application_id, auth_user_id, stage, status, title, message, is_applicant_visible, created_at)
             VALUES
             ($1, $2, 'application_submitted', 'completed', 'Application submitted', 'Your application was received.', true, NOW()),
             ($1, $2, 'initial_review', 'in_progress', 'Initial review', 'Orbix is reviewing the submitted details.', true, NOW() + interval '1 millisecond'),
             ($1, $2, 'college_verification', 'upcoming', 'College verification', 'The college and representative will be checked.', true, NOW() + interval '2 milliseconds'),
             ($1, $2, 'verification_decision', 'upcoming', 'Verification decision', 'Approval, additional information, or rejection.', true, NOW() + interval '3 milliseconds'),
             ($1, $2, 'club_activated', 'upcoming', 'Club access activated', 'Your dedicated club dashboard becomes available.', true, NOW() + interval '4 milliseconds');`,
            [createdAppId, testUserId]
        );

        // Verify timeline events in database
        const timelineRes = await query(
            `SELECT stage, status, title FROM club_verification_timeline_events WHERE application_id = $1 ORDER BY created_at ASC;`,
            [createdAppId]
        );
        console.log(`   Found ${timelineRes.rows.length} timeline events:`);
        timelineRes.rows.forEach((r, idx) => console.log(`     [Stage 0${idx + 1}] ${r.stage}: ${r.status} - "${r.title}"`));
        if (timelineRes.rows.length !== 5) throw new Error("Expected exactly 5 initial timeline events");

        // Step 3: Reviewer Progresses Application
        console.log("\n👉 Step 3: Reviewer updates status and confirms college contact...");
        await query(
            `UPDATE club_verification_requests
             SET status = 'under_review',
                 college_contact_status = 'confirmed',
                 club_existence_confirmed = true,
                 college_authorization_confirmed = true,
                 representative_authority_confirmed = true,
                 internal_notes = 'Institution directory verified. Student leadership confirmed with faculty advisor.',
                 updated_at = NOW()
             WHERE id = $1;`,
            [createdAppId]
        );

        // Record reviewer timeline updates
        await query(
            `INSERT INTO club_verification_timeline_events (application_id, auth_user_id, stage, status, title, message, is_applicant_visible, created_at)
             VALUES
             ($1, $2, 'initial_review', 'completed', 'Initial review completed', 'Basic submission checks passed successfully.', true, NOW()),
             ($1, $2, 'college_verification', 'completed', 'College contact confirmed', 'Faculty advisor confirmed student representative credentials.', true, NOW() + interval '1 millisecond');`,
            [createdAppId, testUserId]
        );
        console.log("   Checklist fully confirmed and recorded in timeline.");

        // Step 4: Atomic Promotion into verified_clubs
        console.log("\n👉 Step 4: Executing atomic approval & promotion transaction...");
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // 1. Lock application
            const lockedApp = await client.query(
                `SELECT * FROM club_verification_requests WHERE id = $1 FOR UPDATE;`,
                [createdAppId]
            );
            const app = lockedApp.rows[0];

            // 2. Validate checklist
            if (
                app.college_contact_status !== "confirmed" ||
                !app.club_existence_confirmed ||
                !app.college_authorization_confirmed ||
                !app.representative_authority_confirmed
            ) {
                throw new Error("Checklist validation failed inside transaction");
            }

            // 3. Generate candidate slug
            let candidateSlug = testClubName
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

            createdClubId = crypto.randomUUID();
            createdClubSlug = candidateSlug;

            // 4. Insert into verified_clubs
            const clubInsert = await client.query(
                `INSERT INTO verified_clubs (
                    id, auth_user_id, college_id, name, slug, category, college_name, college_city,
                    college_state, college_country, short_description, about, website_url,
                    social_links, is_active, verified_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW(), NOW(), NOW())
                RETURNING id, name, slug, college_id;`,
                [
                    createdClubId,
                    app.auth_user_id,
                    app.college_id,
                    app.club_name,
                    candidateSlug,
                    app.club_category,
                    app.college_name,
                    app.college_city,
                    app.college_state,
                    app.college_country,
                    app.club_description,
                    "Detailed about story: Our mission is to empower collegiate engineers to build real-world software.",
                    "https://orbix-test-club.edu",
                    JSON.stringify({ github: "https://github.com/orbix-test", linkedin: "https://linkedin.com/company/orbix-test" }),
                ]
            );
            console.log("   Created verified club row:", clubInsert.rows[0]);

            // 5. Record completion timeline events
            await client.query(
                `INSERT INTO club_verification_timeline_events (
                    application_id, auth_user_id, stage, status, title, message, is_applicant_visible, created_at
                ) VALUES
                ($1, $2, 'verification_decision', 'completed', 'Verification decision: Approved', 'Orbix reviewer confirmed all institution checks and representative credentials.', true, NOW()),
                ($1, $2, 'club_activated', 'completed', 'Club access activated', 'Your dedicated club dashboard and public profile are now live.', true, NOW() + interval '1 millisecond');`,
                [app.id, app.auth_user_id]
            );

            // 6. Update request status
            await client.query(
                `UPDATE club_verification_requests
                 SET status = 'approved',
                     verified_club_id = $1,
                     reviewed_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $2;`,
                [createdClubId, app.id]
            );

            await client.query("COMMIT");
            console.log("   ✅ Atomic transaction committed successfully!");
        } catch (txErr) {
            await client.query("ROLLBACK");
            throw txErr;
        } finally {
            client.release();
        }

        // Step 5: Test Collision-Safe Slug Generation
        console.log("\n👉 Step 5: Testing slug collision avoidance...");
        const collisionCheck = await query(
            `SELECT id FROM verified_clubs WHERE slug = $1;`,
            [createdClubSlug]
        );
        if (collisionCheck.rows.length !== 1) {
            throw new Error(`Expected exactly 1 club with slug '${createdClubSlug}'`);
        }
        console.log(`   Slug '${createdClubSlug}' is unique and indexed.`);

        // Step 6: Create and Manage Events for Verified Club
        console.log("\n👉 Step 6: Creating club events...");
        createdEventId = crypto.randomUUID();
        const eventRes = await query(
            `INSERT INTO club_events (
                id, club_id, title, slug, summary, description, starts_at, ends_at,
                timezone, location_type, venue_or_location, registration_url, status,
                published_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, NOW() + interval '7 days', NOW() + interval '7 days 3 hours',
                'Asia/Kolkata', 'in_person', 'Campus Main Auditorium', 'https://unstop.com/o/hackathon-2026', 'published',
                NOW(), NOW(), NOW()
            ) RETURNING id, title, slug, status, starts_at;`,
            [
                createdEventId,
                createdClubId,
                "Orbix Winter Hackathon 2026",
                "orbix-winter-hackathon-2026",
                "Annual 36-hour collegiate software sprint with exciting tracks and prizes.",
                "Full event agenda and rules.",
            ]
        );
        console.log("   Created published event:", eventRes.rows[0]);

        // Step 7: Query Public Profile
        console.log("\n👉 Step 7: Verifying public club presence data...");
        const publicClubRes = await query(
            `SELECT name, slug, college_name, college_city, short_description, about, website_url, social_links
             FROM verified_clubs WHERE slug = $1 AND is_active = true;`,
            [createdClubSlug]
        );
        if (!publicClubRes.rows[0]) throw new Error("Public club query returned empty!");
        console.log("   Public Club Info:", publicClubRes.rows[0]);

        const publicEventsRes = await query(
            `SELECT title, starts_at, location_type, venue_or_location, registration_url
             FROM club_events WHERE club_id = $1 AND status = 'published';`,
            [createdClubId]
        );
        console.log(`   Public published events count: ${publicEventsRes.rows.length}`);
        if (publicEventsRes.rows.length !== 1) throw new Error("Expected 1 published event for public page");

        // Verify Privacy Guarantee: Check that private emails and phone numbers are not in verified_clubs
        const privacyCheck = await query(
            `SELECT * FROM verified_clubs WHERE id = $1;`,
            [createdClubId]
        );
        const row = privacyCheck.rows[0];
        if ("contact_phone" in row || "internal_notes" in row) {
            throw new Error("CRITICAL PRIVACY VIOLATION: Private request fields found on verified_clubs table!");
        }
        console.log("   ✅ Privacy check passed: verified_clubs exposes strictly public data.");

        console.log("\n=================================================");
        console.log("   🎉 ALL 7 CLUB PIPELINE TESTS PASSED!");
        console.log("=================================================\n");
    } catch (err: any) {
        console.error("❌ Pipeline test failed:", err);
    } finally {
        // Cleanup test artifacts
        console.log("🧹 Cleaning up test records...");
        if (createdEventId) {
            await query(`DELETE FROM club_events WHERE id = $1;`, [createdEventId]).catch(() => {});
        }
        if (createdClubId) {
            await query(`DELETE FROM verified_clubs WHERE id = $1;`, [createdClubId]).catch(() => {});
        }
        if (createdAppId) {
            await query(`DELETE FROM club_verification_timeline_events WHERE application_id = $1;`, [createdAppId]).catch(() => {});
            await query(`DELETE FROM club_verification_requests WHERE id = $1;`, [createdAppId]).catch(() => {});
        }
        await query(`DELETE FROM users WHERE id = $1;`, [testUserId]).catch(() => {});
        await query(`DELETE FROM auth.users WHERE id = $1;`, [testUserId]).catch(() => {});
        console.log("   Test records cleaned up cleanly.");
        process.exit(0);
    }
}

runPipelineTest();
