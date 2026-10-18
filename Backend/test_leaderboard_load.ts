import { calculateOrbixScore, type OrbixScoreInput } from "./src/scoring/orbixScore.js";
import { performance } from "node:perf_hooks";

console.log("=== Running Leaderboard Performance & High-Scale Load Benchmark ===");

// Benchmark 1: Orbix Score Engine Throughput
function benchmarkScoreEngine(count: number) {
    const inputs: OrbixScoreInput[] = [];
    for (let i = 0; i < count; i++) {
        inputs.push({
            problems: {
                easy: (i * 7) % 300,
                medium: (i * 3) % 200,
                hard: i % 50,
                unknownDifficulty: i % 20,
            },
            contests: {
                ratedContestsCount: i % 40,
            },
            activity: {
                activeDaysCount: (i * 5) % 365,
                currentStreak: i % 30,
            },
            ratings: {
                codeforces: 1000 + (i % 1500),
                leetcode: 1400 + (i % 1000),
                codechef: 1300 + (i % 1200),
                atcoder: 300 + (i % 2000),
            },
            github: {
                contributions: (i * 13) % 3000,
            },
        });
    }

    const start = performance.now();
    const scores: number[] = new Array(count);
    for (let i = 0; i < count; i++) {
        scores[i] = calculateOrbixScore(inputs[i]!).totalScore;
    }
    const duration = performance.now() - start;
    const opsPerSec = Math.round((count / duration) * 1000);

    console.log(`\nThroughput for ${count.toLocaleString()} score calculations:`);
    console.log(`  Total time: ${duration.toFixed(2)} ms`);
    console.log(`  Throughput: ${opsPerSec.toLocaleString()} calculations/sec`);
    console.log(`  Average latency: ${(duration / count).toFixed(4)} ms/op`);

    return { duration, opsPerSec };
}

benchmarkScoreEngine(1000);
benchmarkScoreEngine(10000);
benchmarkScoreEngine(50000);

// Benchmark 2: In-Memory Sorting & Pagination Simulation at 100,000 entries
function benchmarkRankingAndPagination(count: number, pageSize = 20) {
    console.log(`\nSimulating 100,000-user Leaderboard Ranking & Pagination:`);
    const coders = new Array(count);
    for (let i = 0; i < count; i++) {
        coders[i] = {
            id: `usr_${i}`,
            username: `coder_${i}`,
            score: (i * 997) % 3500,
            totalSolved: (i * 13) % 1500,
        };
    }

    const sortStart = performance.now();
    coders.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
        return a.username.localeCompare(b.username);
    });
    const sortDuration = performance.now() - sortStart;

    console.log(`  Sort time for ${count.toLocaleString()} coders: ${sortDuration.toFixed(2)} ms`);

    // Top-3 Podium extraction
    const podiumStart = performance.now();
    const podium = [coders[0], coders[1], coders[2]];
    const podiumDuration = performance.now() - podiumStart;
    console.log(`  Podium extraction time: ${podiumDuration.toFixed(4)} ms (Instant)`);

    // Page 1 retrieval
    const page1Start = performance.now();
    const page1 = coders.slice(0, pageSize);
    const page1Duration = performance.now() - page1Start;
    console.log(`  Page 1 slice time (offset 0): ${page1Duration.toFixed(4)} ms`);

    // Page 500 retrieval (offset 10,000)
    const page500Start = performance.now();
    const page500 = coders.slice(10000, 10000 + pageSize);
    const page500Duration = performance.now() - page500Start;
    console.log(`  Page 500 slice time (offset 10,000): ${page500Duration.toFixed(4)} ms`);

    return { sortDuration, podiumDuration, page1Duration, page500Duration };
}

benchmarkRankingAndPagination(100000, 20);

console.log(`\n======================================================`);
console.log(`HIGH-SCALE PERFORMANCE BENCHMARKS COMPLETE!`);
console.log(`======================================================\n`);
