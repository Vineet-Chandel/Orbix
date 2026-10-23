import { query } from "./src/database/client.js";

async function testVerificationRequest() {
    console.log("=== Testing Institution Verification Requests ===");

    // 1. Check existing rows
    const beforeRes = await query("SELECT count(*) as total FROM institution_verification_requests;");
    console.log(`Current rows in institution_verification_requests: ${beforeRes.rows[0].total}`);

    // 2. Direct insert test
    const insertRes = await query(
        `INSERT INTO institution_verification_requests (
            submitted_by_user_id,
            submitted_by_username,
            institution_name,
            institution_website,
            supporting_reference,
            status
        ) VALUES (NULL, 'system_test', 'Test Engineering College XYZ', 'https://xyzcollege.ac.in', 'State: Maharashtra | District: Pune', 'pending')
        RETURNING *;`
    );

    const created = insertRes.rows[0];
    console.log("✅ Successfully inserted verification request:", created);

    // 3. Verify it is queryable
    const checkRes = await query("SELECT * FROM institution_verification_requests WHERE id = $1;", [created.id]);
    console.log("✅ Successfully queried request back:", checkRes.rows[0]);

    // 4. Test HTTP endpoint
    console.log("\n--- Testing HTTP POST /api/institutions/verification-request ---");
    const httpRes = await fetch("http://localhost:3000/api/institutions/verification-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            institutionName: "New Sample College of Engineering",
            institutionWebsite: "https://newsample.edu.in",
            supportingReference: "State: Karnataka | District: Bengaluru",
        }),
    });

    const status = httpRes.status;
    const body = await httpRes.json();
    console.log(`HTTP POST response status: ${status}`);
    if (body.requestId) {
        await query("DELETE FROM institution_verification_requests WHERE id = $1;", [body.requestId]);
    }
    await query("DELETE FROM institution_verification_requests WHERE institution_name LIKE '%Sample College%';");

    // Clean up direct test row
    await query("DELETE FROM institution_verification_requests WHERE id = $1;", [created.id]);
    console.log("✅ Cleaned up all test rows.");
}

testVerificationRequest()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Test failed:", err);
        process.exit(1);
    });
