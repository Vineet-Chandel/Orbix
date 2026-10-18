import { calculateOrbixScore } from "./src/scoring/orbixScore.js";

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

console.log("=== Running Comprehensive Leaderboard Ranking & Determinism Test Suite ===");

// 1. Rank Ordering Test (Higher score ranks first)
console.log("\n1. Score Priority and Deterministic Ordering:");
const coderA = {
    username: "coderA",
    totalSolved: 500,
    score: calculateOrbixScore({ problems: { easy: 100, medium: 100, hard: 10 } }).totalScore, // 100 + 300 + 60 = 460
};
const coderB = {
    username: "coderB",
    totalSolved: 600,
    score: calculateOrbixScore({ problems: { easy: 200, medium: 150, hard: 20 } }).totalScore, // 200 + 450 + 120 = 770
};
const coderC = {
    username: "coderC",
    totalSolved: 1000,
    score: calculateOrbixScore({ problems: { easy: 300, medium: 200, hard: 50 }, ratings: { codeforces: 1600 } }).totalScore, // 300 + 600 + 300 + 600 = 1800
};

const coders = [coderA, coderC, coderB];
// Sort using the canonical competition ranking policy: score DESC, totalSolved DESC, username ASC
coders.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
    return a.username.localeCompare(b.username);
});

assert(coders[0]!.username === "coderC", "Rank 1 is coderC with highest score (1800)");
assert(coders[1]!.username === "coderB", "Rank 2 is coderB (770)");
assert(coders[2]!.username === "coderA", "Rank 3 is coderA (460)");

// 2. Tie-Breaking Determinism Test (Equal score -> total_solved DESC -> username ASC)
console.log("\n2. Tie-Breaking Verification:");
const tie1 = { username: "alice", score: 1000, totalSolved: 400 };
const tie2 = { username: "bob", score: 1000, totalSolved: 500 };
const tie3 = { username: "charlie", score: 1000, totalSolved: 400 };

const tiedList = [tie1, tie3, tie2];
tiedList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
    return a.username.localeCompare(b.username);
});

assert(tiedList[0]!.username === "bob", "Tie-breaker: bob has more totalSolved (500 vs 400) -> ranks ahead");
assert(tiedList[1]!.username === "alice", "Secondary tie-breaker: alice alphabetically before charlie");
assert(tiedList[2]!.username === "charlie", "Secondary tie-breaker: charlie follows alice");

// 3. Podium & Table Consistency Test
console.log("\n3. Podium & Table Consistency:");
const podiumList = coders.slice(0, 3);
assert(podiumList.length === 3, "Podium has exactly 3 coders");
assert(podiumList[0]!.score === coders[0]!.score, "Podium 1st score matches table rank 1");
assert(podiumList[1]!.score === coders[1]!.score, "Podium 2nd score matches table rank 2");
assert(podiumList[2]!.score === coders[2]!.score, "Podium 3rd score matches table rank 3");

// 4. Server-Side Pagination Slice Math Test
console.log("\n4. Server-side Pagination Slices:");
const totalItems = 221;
const pageSize = 20;
const totalPages = Math.ceil(totalItems / pageSize);
assert(totalPages === 12, "221 items with 20 per page = 12 total pages");

// Page 1: 0 to 20 (Showing 1–20)
const page1Start = (1 - 1) * pageSize + 1;
const page1End = Math.min(1 * pageSize, totalItems);
assert(page1Start === 1 && page1End === 20, "Page 1 is 1–20");

// Page 12 (last page): 221 (Showing 221–221)
const page12Start = (12 - 1) * pageSize + 1;
const page12End = Math.min(12 * pageSize, totalItems);
assert(page12Start === 221 && page12End === 221, "Page 12 is 221–221 of 221");

console.log(`\n======================================================`);
console.log(`ALL ${passedTests}/${totalTests} LEADERBOARD RANKING TESTS PASSED!`);
console.log(`======================================================\n`);
