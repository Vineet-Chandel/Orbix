import {
    calculateOrbixScore,
    computeOrbixScoreFromPortals,
    ORBIX_SCORE_VERSION,
} from "./src/scoring/orbixScore.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ ${message}`);
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

console.log("=== Running Comprehensive Orbix Score Specification Test Suite ===");

// 1. Mandatory Specification Benchmark Test: 1,630 Points Example
console.log("\n1. Mandatory Example Test (Exact 1,630 Points Target):");
const exampleResult = calculateOrbixScore({
    problems: {
        easy: 200,
        medium: 150,
        hard: 30,
        unknownDifficulty: 0,
    },
    contests: {
        ratedContestsCount: 20,
    },
    activity: {
        activeDaysCount: 120,
    },
    ratings: {
        codeforces: 1400,
    },
});

assert(exampleResult.breakdown.problems.easy === 200, "200 easy problems");
assert(exampleResult.breakdown.problems.medium === 150, "150 medium problems");
assert(exampleResult.breakdown.problems.hard === 30, "30 hard problems");
assert(exampleResult.breakdown.problems.points === 830, "Problems score: 200*1 + 150*3 + 30*6 = 830");
assert(exampleResult.breakdown.contests.points === 160, "Contest score: 20 * 8 = 160");
assert(exampleResult.breakdown.activity.points === 240, "Activity score: 120 * 2 = 240");
assert(exampleResult.breakdown.ratings.codeforces.points === 400, "CF rating score: 1400 - 1000 = 400");
assert(exampleResult.totalScore === 1630, "TOTAL SCORE IS EXACTLY 1630 POINTS (200+450+180+160+240+400)");

// 2. Baseline Rating Boundary Tests
console.log("\n2. Platform Rating Baseline Tests:");
// Codeforces baseline: 1,000
assert(calculateOrbixScore({ ratings: { codeforces: 999 } }).totalScore === 0, "CF 999 <= 1000 -> 0 pts");
assert(calculateOrbixScore({ ratings: { codeforces: 1000 } }).totalScore === 0, "CF 1000 <= 1000 -> 0 pts");
assert(calculateOrbixScore({ ratings: { codeforces: 1001 } }).totalScore === 1, "CF 1001 -> 1 pt");
assert(calculateOrbixScore({ ratings: { codeforces: 1600 } }).totalScore === 600, "CF 1600 -> 600 pts");

// LeetCode baseline: 1,500
assert(calculateOrbixScore({ ratings: { leetcode: 1499 } }).totalScore === 0, "LC 1499 <= 1500 -> 0 pts");
assert(calculateOrbixScore({ ratings: { leetcode: 1500 } }).totalScore === 0, "LC 1500 <= 1500 -> 0 pts");
assert(calculateOrbixScore({ ratings: { leetcode: 1850 } }).totalScore === 350, "LC 1850 -> 350 pts");
assert(calculateOrbixScore({ ratings: { leetcode: 2150 } }).totalScore === 650, "LC 2150 -> 650 pts");

// CodeChef baseline: 1,400 with 0.8 multiplier
assert(calculateOrbixScore({ ratings: { codechef: 1399 } }).totalScore === 0, "CC 1399 <= 1400 -> 0 pts");
assert(calculateOrbixScore({ ratings: { codechef: 1400 } }).totalScore === 0, "CC 1400 <= 1400 -> 0 pts");
assert(calculateOrbixScore({ ratings: { codechef: 1600 } }).totalScore === 160, "CC 1600 -> 0.8 * 200 = 160 pts");
assert(calculateOrbixScore({ ratings: { codechef: 1900 } }).totalScore === 400, "CC 1900 -> 0.8 * 500 = 400 pts");

// AtCoder baseline: 400 with 0.8 multiplier
assert(calculateOrbixScore({ ratings: { atcoder: 399 } }).totalScore === 0, "AC 399 <= 400 -> 0 pts");
assert(calculateOrbixScore({ ratings: { atcoder: 400 } }).totalScore === 0, "AC 400 <= 400 -> 0 pts");
assert(calculateOrbixScore({ ratings: { atcoder: 800 } }).totalScore === 320, "AC 800 -> 0.8 * 400 = 320 pts");
assert(calculateOrbixScore({ ratings: { atcoder: 1200 } }).totalScore === 640, "AC 1200 -> 0.8 * 800 = 640 pts");

// TopCoder baseline: 1,200 with 0.8 multiplier
assert(calculateOrbixScore({ ratings: { topcoder: 1199 } }).totalScore === 0, "TC 1199 <= 1200 -> 0 pts");
assert(calculateOrbixScore({ ratings: { topcoder: 1200 } }).totalScore === 0, "TC 1200 <= 1200 -> 0 pts");
assert(calculateOrbixScore({ ratings: { topcoder: 1500 } }).totalScore === 240, "TC 1500 -> 0.8 * 300 = 240 pts");

// 3. GitHub Contributions & Capping Tests
console.log("\n3. GitHub Contribution Tests:");
assert(calculateOrbixScore({ github: { contributions: 0 } }).totalScore === 0, "GH 0 -> 0 pts");
assert(calculateOrbixScore({ github: { contributions: 400 } }).totalScore === 100, "GH 400 -> 100 pts (0.25 * 400)");
assert(calculateOrbixScore({ github: { contributions: 2000 } }).totalScore === 500, "GH 2000 -> 500 pts (0.25 * 2000)");
assert(calculateOrbixScore({ github: { contributions: 5000 } }).totalScore === 500, "GH 5000 -> 500 pts (strictly capped at 2000 contributions)");

// 4. Unknown Difficulty Solves Test (U = 2 pts each)
console.log("\n4. Unknown Difficulty Tests (2 pts each):");
const unknownTest = calculateOrbixScore({
    problems: { unknownDifficulty: 45 },
});
assert(unknownTest.breakdown.problems.points === 90, "45 unknown solves = 90 pts (45 * 2)");

// 5. Contest and Activity Deduplication Tests
console.log("\n5. Contest and Activity Deduplication Tests:");
const dedupResult = calculateOrbixScore({
    contests: {
        contestIds: ["cf-123", "cf-124", "cf-123", "lc-45", "lc-45"],
    },
    activity: {
        activeDates: ["2025-01-01", "2025-01-02", "2025-01-01", "2025-01-03T10:00:00Z"],
    },
});
assert(dedupResult.breakdown.contests.ratedCount === 3, "Duplicate contest IDs deduplicated (3 unique)");
assert(dedupResult.breakdown.contests.points === 24, "3 contests * 8 = 24 pts");
assert(dedupResult.breakdown.activity.activeDays === 3, "Duplicate activity dates deduplicated (3 unique days)");
assert(dedupResult.breakdown.activity.points === 6, "3 active days * 2 = 6 pts");

// 6. Zero and Missing Data Tests
console.log("\n6. Zero and Missing Values Tests:");
const emptyScore = calculateOrbixScore({});
assert(emptyScore.totalScore === 0, "Empty input produces 0 total score");
assert(emptyScore.version === ORBIX_SCORE_VERSION, "Version is v1.0.0");
assert(emptyScore.breakdown.ratings.codeforces.rating === null, "Missing CF rating is null, not 0");

// 7. Full Portals Map Aggregation Test
console.log("\n7. computeOrbixScoreFromPortals Integration Test:");
const portalsMap = {
    leetcode: {
        rating: 1850,
        difficulty: { easy: 50, medium: 40, hard: 10 },
        stats: [{ label: "Solved", value: "100" }],
    },
    codeforces: {
        rating: 1500,
        stats: [{ label: "Solved", value: "80" }],
    },
    github: {
        stats: [{ label: "Contributions", value: "1,200" }],
    },
};
const aggregatedScore = computeOrbixScoreFromPortals(portalsMap, [
    { portal: "leetcode", contestId: "w_301" },
    { portal: "codeforces", contestId: "cf_800" },
    { portal: "codeforces", contestId: "cf_800" }, // duplicate
], {
    distinctDates: ["2025-01-01", "2025-01-02", "2025-01-03"],
    currentStreak: 3,
});

// LC: 50*1 + 40*3 + 10*6 = 230
// CF rating: 1500 - 1000 = 500
// LC rating: 1850 - 1500 = 350
// Contests: 2 unique * 8 = 16
// Activity: 3 days * 2 = 6
// GH: 1200 * 0.25 = 300
// CF solves without difficulty: 80 * 2 = 160
// Expected: 230 + 160 + 500 + 350 + 16 + 6 + 300 = 1562
assert(aggregatedScore.breakdown.problems.easy === 50, "Aggregated easy solves = 50");
assert(aggregatedScore.breakdown.problems.medium === 40, "Aggregated medium solves = 40");
assert(aggregatedScore.breakdown.problems.hard === 10, "Aggregated hard solves = 10");
assert(aggregatedScore.breakdown.problems.unknown === 80, "Aggregated unknown solves = 80");
assert(aggregatedScore.breakdown.contests.ratedCount === 2, "Aggregated rated contests = 2");
assert(aggregatedScore.breakdown.activity.activeDays === 3, "Aggregated active days = 3");
assert(aggregatedScore.breakdown.github.contributions === 1200, "Aggregated GH contributions = 1200");
assert(aggregatedScore.totalScore === 1562, `Total aggregated score = 1562 (got ${aggregatedScore.totalScore})`);

console.log(`\n======================================================`);
console.log(`ALL ${passedTests}/${totalTests} ORBIX SCORING TESTS PASSED CLEANLY!`);
console.log(`======================================================\n`);
