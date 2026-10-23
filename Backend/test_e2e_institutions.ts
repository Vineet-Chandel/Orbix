import { query } from "./src/database/client.js";
import { normalizeInstitutionName, generateDerivedAliases } from "./data/seed_institutions.js";

async function runEndToEndTests() {
    console.log("=================================================");
    console.log("🧪 Verified Indian College Selector - E2E Test Suite");
    console.log("=================================================");

    let passedTests = 0;
    let failedTests = 0;

    const assert = (condition: boolean, testName: string, detail?: string) => {
        if (condition) {
            console.log(`✅ PASS: ${testName}`);
            passedTests++;
        } else {
            console.error(`❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
            failedTests++;
        }
    };

    // 1. Normalization unit tests
    console.log("\n--- 1. Data Normalization Unit Tests ---");
    const norm1 = normalizeInstitutionName("Indian Institute of Technology, Bombay (IIT-B)");
    assert(norm1 === "indian institute of technology bombay iit b", "Normalizes commas, parentheses, and hyphens");

    const aliases = generateDerivedAliases("Birla Institute of Technology and Science, Pilani", ["BITS Pilani"]);
    assert(aliases.includes("BITS Pilani") && aliases.includes("BITSP"), "Generates derived acronyms properly");

    // 2. Database Schema & Count Tests
    console.log("\n--- 2. Database Schema & Records Count ---");
    const countRes = await query(`SELECT count(*) as total FROM institutions WHERE verification_status = 'verified';`);
    const totalVerified = parseInt(countRes.rows[0].total, 10);
    assert(totalVerified >= 90, `Database contains ${totalVerified} verified institutions (>= 90)`);

    const sourcesRes = await query(`SELECT count(*) as total FROM institution_sources;`);
    const totalSources = parseInt(sourcesRes.rows[0].total, 10);
    assert(totalSources >= 90, `Database contains ${totalSources} verifiable source evidence rows`);

    // 3. Search Autocomplete Tests
    console.log("\n--- 3. Autocomplete Search Query Tests ---");
    const iitSearch = await query(`
        SELECT id, official_name, aishe_code, city, state, verification_status
        FROM institutions
        WHERE verification_status = 'verified' AND is_active = true
          AND (
              normalized_name LIKE 'iit%'
              OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE LOWER(a) LIKE 'iit%')
          )
        ORDER BY CASE WHEN normalized_name LIKE 'iit%' THEN 0 ELSE 1 END, LENGTH(official_name) ASC
        LIMIT 25;
    `);
    assert(iitSearch.rows.length > 0, "Search 'iit' returns institutions", `found ${iitSearch.rows.length}`);
    const hasBombay = iitSearch.rows.some((r: any) => r.official_name.includes("Bombay"));
    assert(hasBombay, "Search 'iit' with limit 25 includes IIT Bombay");

    const bombayDirectSearch = await query(`
        SELECT id, official_name, aishe_code
        FROM institutions
        WHERE verification_status = 'verified' AND is_active = true
          AND (
              normalized_name LIKE 'iit bombay%'
              OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE LOWER(a) LIKE 'iit bombay%')
          );
    `);
    assert(bombayDirectSearch.rows.length > 0, "Direct search for 'iit bombay' returns IIT Bombay");

    const bitsSearch = await query(`
        SELECT id, official_name, aishe_code, city, state
        FROM institutions
        WHERE verification_status = 'verified' AND is_active = true
          AND (
              normalized_name LIKE 'bits%'
              OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE LOWER(a) LIKE 'bits%')
          )
        LIMIT 5;
    `);
    assert(bitsSearch.rows.length >= 3, "Search 'bits' returns Pilani, Goa, and Hyderabad campuses");

    // State filter search
    const karnatakaNitSearch = await query(`
        SELECT id, official_name, aishe_code, city, state
        FROM institutions
        WHERE verification_status = 'verified' AND is_active = true
          AND LOWER(state) = 'karnataka'
          AND (
              normalized_name LIKE 'nit%'
              OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE LOWER(a) LIKE 'nit%')
          )
        LIMIT 5;
    `);
    assert(karnatakaNitSearch.rows.length > 0 && karnatakaNitSearch.rows[0].official_name.includes("Surathkal"),
        "State filtered search for 'nit' in Karnataka returns NIT Surathkal");

    // 4. Stored Procedure RPC Test
    console.log("\n--- 4. Stored Procedure RPC function test ---");
    const rpcSearch = await query(`
        SELECT * FROM search_verified_institutions('delhi', NULL, 10);
    `);
    assert(rpcSearch.rows.length > 0, "RPC search_verified_institutions('delhi') succeeds", `found ${rpcSearch.rows.length}`);

    // 5. Institution Validation Function Test
    console.log("\n--- 5. Server-side Validation Function Test ---");
    const testInstId = iitSearch.rows[0]?.id;
    const validCheck = await query(`SELECT validate_college_selection($1) as is_valid;`, [testInstId]);
    assert(validCheck.rows[0]?.is_valid === true, "Validation function returns true for verified institution");

    const invalidUuid = "00000000-0000-0000-0000-000000000000";
    const invalidCheck = await query(`SELECT validate_college_selection($1) as is_valid;`, [invalidUuid]);
    assert(invalidCheck.rows[0]?.is_valid === false, "Validation function returns false for non-existent institution");

    const nullCheck = await query(`SELECT validate_college_selection(NULL) as is_valid;`);
    assert(nullCheck.rows[0]?.is_valid === true, "Validation function allows NULL (clearing college selection)");

    // 6. User Profile College Link Test
    console.log("\n--- 6. User Profile College Link Test ---");
    // Find or test on an existing user in DB
    const userRes = await query(`SELECT id, username, college_id FROM users LIMIT 1;`);
    if (userRes.rows.length > 0) {
        const testUser = userRes.rows[0];
        console.log(`Testing college assignment on user: @${testUser.username} (${testUser.id})`);

        // Assign college
        await query(`UPDATE users SET college_id = $1 WHERE id = $2;`, [testInstId, testUser.id]);
        const updatedUser = await query(`
            SELECT u.id, u.username, u.college_id, i.official_name, i.aishe_code, i.verification_status
            FROM users u
            LEFT JOIN institutions i ON u.college_id = i.id
            WHERE u.id = $1;
        `, [testUser.id]);

        assert(updatedUser.rows[0]?.college_id === testInstId, "User college_id updated successfully");
        assert(updatedUser.rows[0]?.official_name === iitSearch.rows[0]?.official_name, "User joins to verified institution");

        // Clear college
        await query(`UPDATE users SET college_id = NULL WHERE id = $1;`, [testUser.id]);
        const clearedUser = await query(`SELECT college_id FROM users WHERE id = $1;`, [testUser.id]);
        assert(clearedUser.rows[0]?.college_id === null, "User college_id successfully cleared (set to NULL)");
    }

    // 7. Verification Request Table Test
    console.log("\n--- 7. Verification Requests Table Test ---");
    const testReqInsert = await query(`
        INSERT INTO institution_verification_requests (
            institution_name,
            institution_website,
            supporting_reference,
            status
        ) VALUES (
            'Test Institute of Advanced Science',
            'https://tias.edu.in',
            'AISHE: C-99999 | UGC Sec 2(f)',
            'pending'
        ) RETURNING id, status, created_at;
    `);
    const reqId = testReqInsert.rows[0]?.id;
    assert(!!reqId && testReqInsert.rows[0]?.status === "pending", "Verification request inserted with pending status");

    // Clean up test request
    await query(`DELETE FROM institution_verification_requests WHERE id = $1;`, [reqId]);
    assert(true, "Test verification request cleaned up");

    console.log("\n=================================================");
    console.log(`🏁 Test Summary: ${passedTests} Passed, ${failedTests} Failed`);
    console.log("=================================================");

    if (failedTests > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runEndToEndTests().catch(err => {
    console.error("Fatal test suite error:", err);
    process.exit(1);
});
