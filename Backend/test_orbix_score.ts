import {
    calculateOrbixScore,
    calculateOrbixScoreV1,
    calculateOrbixScoreV2,
    computeOrbixScoreFromPortals,
    ORBIX_SCORE_VERSION,
    ORBIX_SCORE_V1,
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

console.log("=== Running Comprehensive Orbix Score Specification & Rebuild Test Suite ===");

// =============================================================================
// PART 1: Backwards-Compatible v1.0.0 Specification Tests
// =============================================================================
console.log("\n--- Part 1: Legacy v1.0.0 Specification Mode Benchmark Tests ---");

// 1. Mandatory Specification Benchmark Test: 1,630 Points Example
console.log("\n1. Mandatory Example Test (Exact 1,630 Points Target in v1 mode):");
const exampleResultV1 = calculateOrbixScore({
    version: ORBIX_SCORE_V1,
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

assert(exampleResultV1.breakdown.problems.easy === 200, "200 easy problems");
assert(exampleResultV1.breakdown.problems.medium === 150, "150 medium problems");
assert(exampleResultV1.breakdown.problems.hard === 30, "30 hard problems");
assert(exampleResultV1.breakdown.problems.points === 830, "Problems score: 200*1 + 150*3 + 30*6 = 830");
assert(exampleResultV1.breakdown.contests.points === 160, "Contest score: 20 * 8 = 160");
assert(exampleResultV1.breakdown.activity.points === 240, "Activity score: 120 * 2 = 240");
assert(exampleResultV1.breakdown.ratings.codeforces.points === 400, "CF rating score: 1400 - 1000 = 400");
assert(exampleResultV1.totalScore === 1630, "TOTAL SCORE IS EXACTLY 1630 POINTS (200+450+180+160+240+400)");

// 2. Baseline Rating Boundary Tests in v1 mode
console.log("\n2. Platform Rating Baseline Tests (v1 mode):");
assert(calculateOrbixScoreV1({ ratings: { codeforces: 999 } }).totalScore === 0, "CF 999 <= 1000 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { codeforces: 1000 } }).totalScore === 0, "CF 1000 <= 1000 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { codeforces: 1001 } }).totalScore === 1, "CF 1001 -> 1 pt");
assert(calculateOrbixScoreV1({ ratings: { codeforces: 1600 } }).totalScore === 600, "CF 1600 -> 600 pts");

assert(calculateOrbixScoreV1({ ratings: { leetcode: 1499 } }).totalScore === 0, "LC 1499 <= 1500 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { leetcode: 1500 } }).totalScore === 0, "LC 1500 <= 1500 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { leetcode: 1850 } }).totalScore === 350, "LC 1850 -> 350 pts");
assert(calculateOrbixScoreV1({ ratings: { leetcode: 2150 } }).totalScore === 650, "LC 2150 -> 650 pts");

assert(calculateOrbixScoreV1({ ratings: { codechef: 1399 } }).totalScore === 0, "CC 1399 <= 1400 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { codechef: 1400 } }).totalScore === 0, "CC 1400 <= 1400 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { codechef: 1600 } }).totalScore === 160, "CC 1600 -> 0.8 * 200 = 160 pts");
assert(calculateOrbixScoreV1({ ratings: { codechef: 1900 } }).totalScore === 400, "CC 1900 -> 0.8 * 500 = 400 pts");

assert(calculateOrbixScoreV1({ ratings: { atcoder: 399 } }).totalScore === 0, "AC 399 <= 400 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { atcoder: 400 } }).totalScore === 0, "AC 400 <= 400 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { atcoder: 800 } }).totalScore === 320, "AC 800 -> 0.8 * 400 = 320 pts");
assert(calculateOrbixScoreV1({ ratings: { atcoder: 1200 } }).totalScore === 640, "AC 1200 -> 0.8 * 800 = 640 pts");

assert(calculateOrbixScoreV1({ ratings: { topcoder: 1199 } }).totalScore === 0, "TC 1199 <= 1200 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { topcoder: 1200 } }).totalScore === 0, "TC 1200 <= 1200 -> 0 pts");
assert(calculateOrbixScoreV1({ ratings: { topcoder: 1500 } }).totalScore === 240, "TC 1500 -> 0.8 * 300 = 240 pts");

// 3. GitHub Contributions & Capping Tests (v1 mode)
console.log("\n3. GitHub Contribution Tests (v1 mode):");
assert(calculateOrbixScoreV1({ github: { contributions: 0 } }).totalScore === 0, "GH 0 -> 0 pts");
assert(calculateOrbixScoreV1({ github: { contributions: 400 } }).totalScore === 100, "GH 400 -> 100 pts (0.25 * 400)");
assert(calculateOrbixScoreV1({ github: { contributions: 2000 } }).totalScore === 500, "GH 2000 -> 500 pts (0.25 * 2000)");
assert(calculateOrbixScoreV1({ github: { contributions: 5000 } }).totalScore === 500, "GH 5000 -> 500 pts (strictly capped at 2000 contributions)");

// 4. Deduplication Tests (v1 mode)
console.log("\n4. Contest and Activity Deduplication Tests (v1 mode):");
const dedupResultV1 = calculateOrbixScoreV1({
    contests: {
        contestIds: ["cf-123", "cf-124", "cf-123", "lc-45", "lc-45"],
    },
    activity: {
        activeDates: ["2025-01-01", "2025-01-02", "2025-01-01", "2025-01-03T10:00:00Z"],
    },
});
assert(dedupResultV1.breakdown.contests.ratedCount === 3, "Duplicate contest IDs deduplicated (3 unique)");
assert(dedupResultV1.breakdown.contests.points === 24, "3 contests * 8 = 24 pts");
assert(dedupResultV1.breakdown.activity.activeDays === 3, "Duplicate activity dates deduplicated (3 unique days)");
assert(dedupResultV1.breakdown.activity.points === 6, "3 active days * 2 = 6 pts");

// =============================================================================
// PART 2: Authoritative v2.0.0 Multi-Pillar & Diminishing Returns Engine Tests
// =============================================================================
console.log("\n--- Part 2: Authoritative v2.0.0 Multi-Pillar Engine Tests ---");

// 5. Version Verification & Empty State
const emptyScoreV2 = calculateOrbixScore({});
assert(emptyScoreV2.totalScore === 0, "Empty input produces 0 total score in v2");
assert(emptyScoreV2.version === ORBIX_SCORE_VERSION, `Version is authoritative ${ORBIX_SCORE_VERSION}`);
assert(emptyScoreV2.breakdown.problems.weight === 0.35, "Problem solving weight is 35%");
assert(emptyScoreV2.breakdown.contests.weight === 0.20, "Contests weight is 20%");
assert(emptyScoreV2.breakdown.openSource.weight === 0.20, "Open Source weight is 20%");
assert(emptyScoreV2.breakdown.repositories.weight === 0.10, "Repositories weight is 10%");
assert(emptyScoreV2.breakdown.consistency.weight === 0.10, "Consistency weight is 10%");
assert(emptyScoreV2.breakdown.writing.weight === 0.05, "Writing weight is 5%");

// 6. Diminishing Returns on Extreme Solves
console.log("\n6. Diminishing Returns on Extreme Problem Volumes:");
const solver100 = calculateOrbixScore({ problems: { medium: 100 } }); // 300 raw pts
const solver500 = calculateOrbixScore({ problems: { medium: 500 } }); // 1,500 raw pts
const solver5000 = calculateOrbixScore({ problems: { medium: 5000 } }); // 15,000 raw pts

assert(solver100.breakdown.problems.points > 0, "100 mediums gets points");
assert(solver500.breakdown.problems.points > solver100.breakdown.problems.points, "500 mediums beats 100 mediums");
assert(solver5000.breakdown.problems.points <= 3500, "5000 mediums is strictly bounded by max 3,500 pts");
assert(solver5000.breakdown.problems.points < solver500.breakdown.problems.points * 2, "Diminishing returns prevents 10x multiplier from 10x problem spam");

// 7. Multi-Pillar Developer Identity Score
console.log("\n7. Balanced All-Round Developer Score:");
const balancedDev = calculateOrbixScore({
    problems: { easy: 100, medium: 150, hard: 30 },
    ratings: { leetcode: 1950, codeforces: 1550 },
    contests: { ratedContestsCount: 25 },
    openSource: { mergedPRs: 8, externalReposCount: 3, codeReviews: 5 },
    repositories: { publicRepos: 12, stars: 120, forks: 15, languagesCount: 4 },
    activity: { activeDaysCount: 180, recentDays30Count: 22, currentStreak: 35 },
    writing: { articleCount: 4, followersCount: 250, platforms: ["medium", "substack"] },
});

assert(balancedDev.totalScore > 3000, `Balanced dev gets strong score: ${balancedDev.totalScore} > 3000`);
assert(balancedDev.totalScore <= 10000, `Balanced dev score <= 10000 (${balancedDev.totalScore})`);
assert(balancedDev.breakdown.openSource.points > 0, `Open source contribution recognized: ${balancedDev.breakdown.openSource.points} pts`);
assert(balancedDev.breakdown.repositories.points > 0, `Repository quality recognized: ${balancedDev.breakdown.repositories.points} pts`);
assert(balancedDev.breakdown.writing.points > 0, `Technical writing recognized: ${balancedDev.breakdown.writing.points} pts`);
assert(balancedDev.breakdown.openSource.milestoneBonus === true, "First open source milestone bonus awarded");

// 8. computeOrbixScoreFromPortals Across All Platform Types
console.log("\n8. computeOrbixScoreFromPortals Across All Platform Types:");
const fullPortalsMap = {
    leetcode: {
        difficulty: { easy: 80, medium: 90, hard: 20 },
        stats: [{ label: "Solved", value: "190" }, { label: "Rating", value: "1920" }, { label: "Streak", value: "45" }],
    },
    codeforces: {
        stats: [{ label: "Solved", value: "120" }, { label: "Rating", value: "1450" }, { label: "Contests", value: "18" }],
    },
    codechef: {
        stats: [{ label: "Solved", value: "50" }, { label: "Rating", value: "1680" }],
    },
    github: {
        stats: [
            { label: "Repositories", value: "14" },
            { label: "Contributions", value: "850" },
            { label: "Pull Requests", value: "12" },
            { label: "Stars", value: "48" },
        ],
    },
    medium: {
        stats: [{ label: "Articles", value: "5" }, { label: "Followers", value: "120" }],
    },
};

const fullAggregated = computeOrbixScoreFromPortals(fullPortalsMap, [
    { portal: "leetcode", contestId: "w_380" },
    { portal: "codeforces", contestId: "cf_920" },
], {
    activeDays: 95,
    currentStreak: 45,
    recentDays30: 18,
});

assert(fullAggregated.totalScore > 0, `Full aggregated score is positive: ${fullAggregated.totalScore}`);
assert(fullAggregated.version === ORBIX_SCORE_VERSION, "Aggregated score uses v2.0.0");
assert(fullAggregated.breakdown.problems.totalSolved > 0, `Total solved aggregated: ${fullAggregated.breakdown.problems.totalSolved}`);
assert(fullAggregated.breakdown.openSource.points > 0, `GitHub PRs aggregated into Open Source: ${fullAggregated.breakdown.openSource.points}`);
assert(fullAggregated.breakdown.writing.points > 0, `Medium articles aggregated into Writing: ${fullAggregated.breakdown.writing.points}`);

console.log(`\n========================================================================`);
console.log(`ALL ${passedTests}/${totalTests} ORBIX SCORING ENGINE TESTS PASSED CLEANLY!`);
console.log(`========================================================================\n`);
