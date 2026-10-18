import {
    getCodeforcesTier,
    getLeetCodeTier,
    getCodeChefTier,
    getCodeChefDivision,
    getAtCoderTier,
    getHackerRankProblemSolvingStars,
    isContestRatingPlatform,
} from "./src/utils/ratingSystems.js";

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

console.log("=== Running Comprehensive Rating Systems Audit Test Suite ===");

// 1. Codeforces Boundary Tests
console.log("\n1. Codeforces Boundary Tests:");
assert(getCodeforcesTier(0).name === "Newbie", "0 rating is Newbie");
assert(getCodeforcesTier(1199).name === "Newbie", "1199 rating is Newbie");
assert(getCodeforcesTier(1200).name === "Pupil", "1200 rating is Pupil");
assert(getCodeforcesTier(1399).name === "Pupil", "1399 rating is Pupil");
assert(getCodeforcesTier(1400).name === "Specialist", "1400 rating is Specialist");
assert(getCodeforcesTier(1599).name === "Specialist", "1599 rating is Specialist");
assert(getCodeforcesTier(1600).name === "Expert", "1600 rating is Expert");
assert(getCodeforcesTier(1899).name === "Expert", "1899 rating is Expert");
assert(getCodeforcesTier(1900).name === "Candidate Master", "1900 rating is Candidate Master (NOT Master)");
assert(getCodeforcesTier(2099).name === "Candidate Master", "2099 rating is Candidate Master");
assert(getCodeforcesTier(2100).name === "Master", "2100 rating is Master");
assert(getCodeforcesTier(2299).name === "Master", "2299 rating is Master");
assert(getCodeforcesTier(2300).name === "International Master", "2300 rating is International Master");
assert(getCodeforcesTier(2400).name === "Grandmaster", "2400 rating is Grandmaster");
assert(getCodeforcesTier(2600).name === "International Grandmaster", "2600 rating is International Grandmaster");
assert(getCodeforcesTier(3000).name === "Legendary Grandmaster", "3000 rating is Legendary Grandmaster");

// 2. LeetCode Boundary Tests
console.log("\n2. LeetCode Boundary Tests:");
assert(getLeetCodeTier(1500).name === "Unranked", "1500 is Unranked");
assert(getLeetCodeTier(1849).name === "Unranked", "1849 is Unranked");
assert(getLeetCodeTier(1850).name === "Knight", "1850 is Knight");
assert(getLeetCodeTier(2149).name === "Knight", "2149 is Knight");
assert(getLeetCodeTier(2150).name === "Guardian", "2150 is Guardian");
assert(getLeetCodeTier(3200).name === "Guardian", "3200 is Guardian");

// 3. CodeChef Boundary Tests
console.log("\n3. CodeChef Boundary & Division Tests:");
assert(getCodeChefTier(1300).name === "1★", "1300 is 1★");
assert(getCodeChefTier(1399).name === "1★", "1399 is 1★");
assert(getCodeChefTier(1400).name === "2★", "1400 is 2★");
assert(getCodeChefTier(1599).name === "2★", "1599 is 2★");
assert(getCodeChefTier(1600).name === "3★", "1600 is 3★");
assert(getCodeChefTier(1799).name === "3★", "1799 is 3★");
assert(getCodeChefTier(1800).name === "4★", "1800 is 4★");
assert(getCodeChefTier(1999).name === "4★", "1999 is 4★");
assert(getCodeChefTier(2000).name === "5★", "2000 is 5★");
assert(getCodeChefTier(2199).name === "5★", "2199 is 5★");
assert(getCodeChefTier(2200).name === "6★", "2200 is 6★");
assert(getCodeChefTier(2499).name === "6★", "2499 is 6★");
assert(getCodeChefTier(2500).name === "7★", "2500 is 7★");
assert(getCodeChefDivision(1300).division === "Div 4", "1300 is Div 4");
assert(getCodeChefDivision(1450).division === "Div 3", "1450 is Div 3");
assert(getCodeChefDivision(1700).division === "Div 2", "1700 is Div 2");
assert(getCodeChefDivision(2100).division === "Div 1", "2100 is Div 1");

// 4. AtCoder Boundary Tests
console.log("\n4. AtCoder Color Tests:");
assert(getAtCoderTier(350).name === "Gray", "350 is Gray");
assert(getAtCoderTier(400).name === "Brown", "400 is Brown");
assert(getAtCoderTier(800).name === "Green", "800 is Green");
assert(getAtCoderTier(1200).name === "Cyan", "1200 is Cyan");
assert(getAtCoderTier(1600).name === "Blue", "1600 is Blue");
assert(getAtCoderTier(2000).name === "Yellow", "2000 is Yellow");
assert(getAtCoderTier(2400).name === "Orange", "2400 is Orange");
assert(getAtCoderTier(2800).name === "Red", "2800 is Red");

// 5. HackerRank Problem Solving Star Thresholds
console.log("\n5. HackerRank Star Tests:");
assert(getHackerRankProblemSolvingStars(10).stars === 0, "10 points is 0 stars");
assert(getHackerRankProblemSolvingStars(30).stars === 1, "30 points is 1 star");
assert(getHackerRankProblemSolvingStars(100).stars === 2, "100 points is 2 stars");
assert(getHackerRankProblemSolvingStars(200).stars === 3, "200 points is 3 stars");
assert(getHackerRankProblemSolvingStars(475).stars === 4, "475 points is 4 stars");
assert(getHackerRankProblemSolvingStars(850).stars === 5, "850 points is 5 stars");
assert(getHackerRankProblemSolvingStars(2200).stars === 6, "2200 points is 6 stars");

// 6. Contest Platform Differentiation
console.log("\n6. Authentic Contest Platform Eligibility Verification:");
assert(isContestRatingPlatform("codeforces") === true, "codeforces is authentic contest platform");
assert(isContestRatingPlatform("leetcode") === true, "leetcode is authentic contest platform");
assert(isContestRatingPlatform("codechef") === true, "codechef is authentic contest platform");
assert(isContestRatingPlatform("atcoder") === true, "atcoder is authentic contest platform");
assert(isContestRatingPlatform("geeksforgeeks") === false, "geeksforgeeks practice score is NOT a contest rating");
assert(isContestRatingPlatform("hackerrank") === false, "hackerrank domain score is NOT a contest rating");
assert(isContestRatingPlatform("interviewbit") === false, "interviewbit streak/score is NOT a contest rating");
assert(isContestRatingPlatform("github") === false, "github is a development platform, NOT a contest rating");

console.log(`\n======================================================`);
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
console.log(`======================================================\n`);
