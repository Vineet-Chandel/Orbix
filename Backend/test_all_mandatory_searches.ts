import { query } from "./src/database/client.js";

interface MandatoryTestCase {
    query: string;
    description: string;
    expectedSubstrings: string[];
}

const MANDATORY_TESTS: MandatoryTestCase[] = [
    {
        query: "PSIT",
        description: "Acronym for Pranveer Singh Institute of Technology",
        expectedSubstrings: ["PSIT", "Pranveer Singh Institute of Technology"],
    },
    {
        query: "PSIT Kanpur",
        description: "Acronym with city",
        expectedSubstrings: ["PSIT", "Pranveer Singh Institute of Technology"],
    },
    {
        query: "Pranve",
        description: "Prefix search for Pranveer Singh Institute of Technology",
        expectedSubstrings: ["Pranveer Singh Institute of Technology"],
    },
    {
        query: "Pranveer Singh Institute of Technology",
        description: "Full official name prefix",
        expectedSubstrings: ["Pranveer Singh Institute of Technology"],
    },
    {
        query: "Galgotias",
        description: "Popular brand name for Galgotias University / College",
        expectedSubstrings: ["Galgotias"],
    },
    {
        query: "Galgotias University",
        description: "Full university name",
        expectedSubstrings: ["Galgotias University"],
    },
    {
        query: "Chandigarh University",
        description: "Private university (with Mohali location suffix in DB)",
        expectedSubstrings: ["Chandigarh University"],
    },
    {
        query: "IIT Kanpur",
        description: "Institute of National Importance via alias/city",
        expectedSubstrings: ["Indian Institute of Technology Kanpur"],
    },
    {
        query: "NIT Trichy",
        description: "NIT via common colloquial short name",
        expectedSubstrings: ["National Institute of Technology Tiruchirappalli"],
    },
    {
        query: "BITS Pilani",
        description: "Deemed university via abbreviation & campus",
        expectedSubstrings: ["Birla Institute of Technology and Science, Pilani"],
    },
    {
        query: "VIT",
        description: "Deemed university via acronym",
        expectedSubstrings: ["Vellore Institute of Technology"],
    },
    {
        query: "Manipal",
        description: "Deemed university via brand name",
        expectedSubstrings: ["Manipal Academy of Higher Education"],
    },
    {
        query: "Delhi University",
        description: "Central university via colloquial inversion of University of Delhi",
        expectedSubstrings: ["University of Delhi"],
    },
];

async function runMandatorySearches() {
    console.log("================================================================================");
    console.log("🎯 LIVE TESTING MANDATORY INSTITUTION SEARCHES");
    console.log("================================================================================");

    let allPassed = true;

    for (const testCase of MANDATORY_TESTS) {
        const cleanQuery = testCase.query.trim();

        // 1. Direct Stored Procedure RPC Call
        const dbResult = await query(
            `SELECT
                id,
                official_name AS "officialName",
                city,
                state,
                district,
                institution_type AS "institutionType",
                aishe_code AS "aisheCode",
                verification_status AS "verificationStatus"
            FROM search_verified_institutions($1, NULL, 5);`,
            [cleanQuery]
        );

        const rows = dbResult.rows;
        const topMatch = rows[0];

        // Check if at least one expected substring matches the top match or any of the top 3 matches
        const matched = rows.some((r) =>
            testCase.expectedSubstrings.some((exp) =>
                r.officialName.toLowerCase().includes(exp.toLowerCase())
            )
        );

        if (matched && topMatch) {
            console.log(`✅ PASS: "${testCase.query}"`);
            console.log(`   ↳ Found ${rows.length} results. Top: "${topMatch.officialName}"`);
            console.log(`   ↳ State: ${topMatch.state} | AISHE: ${topMatch.aisheCode} | Status: ${topMatch.verificationStatus}\n`);
        } else {
            allPassed = false;
            console.error(`❌ FAIL: "${testCase.query}" (${testCase.description})`);
            console.error(`   ↳ Expected one of: ${JSON.stringify(testCase.expectedSubstrings)}`);
            console.error(`   ↳ Actual returned: ${JSON.stringify(rows.map((r) => r.officialName))}\n`);
        }
    }

    // Also test HTTP Endpoint directly
    console.log("--------------------------------------------------------------------------------");
    console.log("🌐 Testing HTTP REST API Endpoint (/api/institutions/search)...");
    const httpRes = await fetch("http://localhost:3000/api/institutions/search?q=PSIT");
    const httpJson: any = await httpRes.json();
    if (httpJson.success && httpJson.institutions?.length > 0) {
        console.log(`✅ PASS: HTTP /api/institutions/search?q=PSIT returned ${httpJson.institutions.length} verified results.`);
        console.log(`   ↳ Top item: "${httpJson.institutions[0].officialName}" (${httpJson.institutions[0].aisheCode})`);
    } else {
        console.error("❌ FAIL: HTTP /api/institutions/search?q=PSIT returned:", httpJson);
        allPassed = false;
    }

    console.log("================================================================================");
    if (allPassed) {
        console.log("🎉 ALL 13 MANDATORY SEARCH TEST CASES PASSED SUCCESSFULLY!");
    } else {
        console.error("⚠️ SOME TEST CASES FAILED. CHECK DETAILS ABOVE.");
        process.exit(1);
    }
    console.log("================================================================================");
}

runMandatorySearches()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error running search tests:", err);
        process.exit(1);
    });
