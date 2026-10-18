import "dotenv/config";
import { query, pool, testDatabaseConnection } from "./src/database/client.js";
import { calculateOrbixScore } from "./src/scoring/orbixScore.js";
import { getCodeforcesTier, getLeetCodeTier, getCodeChefTier, getAtCoderTier } from "./src/utils/ratingSystems.js";
import { clearLeaderboardCache } from "./src/Routes/leaderboard/leaderboard.js";
import bcrypt from "bcrypt";

interface SeedCoder {
    username: string;
    displayName: string;
    email: string;
    college: string;
    isVerified: boolean;
    streak: number;
    cfRating?: number;
    lcRating?: number;
    lcBadge?: string;
    ccRating?: number;
    acRating?: number;
    tcRating?: number;
    easy: number;
    medium: number;
    hard: number;
    unrated: number;
    contests: number;
    activeDays: number;
    githubContributions: number;
}

const SAMPLE_CODERS: SeedCoder[] = [
    {
        username: "tourist_fan",
        displayName: "Gennady Korotkevich",
        email: "gennady@orbix.dev",
        college: "ITMO University",
        isVerified: true,
        streak: 184,
        cfRating: 3780, // Legendary Grandmaster
        lcRating: 3450,
        lcBadge: "Guardian",
        ccRating: 2950, // 7-star
        acRating: 3820,
        easy: 450,
        medium: 620,
        hard: 380,
        unrated: 120,
        contests: 145,
        activeDays: 320,
        githubContributions: 2400,
    },
    {
        username: "benq_coder",
        displayName: "Benjamin Qi",
        email: "benq@orbix.dev",
        college: "MIT",
        isVerified: true,
        streak: 92,
        cfRating: 3510, // International Grandmaster
        lcRating: 3200,
        lcBadge: "Guardian",
        ccRating: 2780, // 6-star
        acRating: 3250,
        easy: 380,
        medium: 510,
        hard: 290,
        unrated: 95,
        contests: 110,
        activeDays: 260,
        githubContributions: 1850,
    },
    {
        username: "ecnerwala",
        displayName: "Andrew He",
        email: "andrew@orbix.dev",
        college: "MIT",
        isVerified: true,
        streak: 64,
        cfRating: 3320, // Grandmaster
        lcRating: 3050,
        lcBadge: "Guardian",
        ccRating: 2620, // 6-star
        easy: 310,
        medium: 440,
        hard: 240,
        unrated: 80,
        contests: 88,
        activeDays: 210,
        githubContributions: 1420,
    },
    {
        username: "aryan_iitb",
        displayName: "Aryan Sharma",
        email: "aryan@iitb.ac.in",
        college: "IIT Bombay",
        isVerified: true,
        streak: 45,
        cfRating: 2420, // Grandmaster
        lcRating: 2750,
        lcBadge: "Guardian",
        ccRating: 2450, // 6-star
        easy: 280,
        medium: 390,
        hard: 160,
        unrated: 50,
        contests: 65,
        activeDays: 190,
        githubContributions: 980,
    },
    {
        username: "priya_ai",
        displayName: "Priya Nair",
        email: "priya@stanford.edu",
        college: "Stanford University",
        isVerified: true,
        streak: 38,
        cfRating: 2180, // Master
        lcRating: 2610,
        lcBadge: "Guardian",
        ccRating: 2210, // 5-star
        acRating: 2100,
        easy: 250,
        medium: 340,
        hard: 130,
        unrated: 40,
        contests: 52,
        activeDays: 175,
        githubContributions: 1250,
    },
    {
        username: "alex_chen",
        displayName: "Alex Chen",
        email: "alex@cmu.edu",
        college: "Carnegie Mellon University",
        isVerified: true,
        streak: 29,
        cfRating: 1980, // Candidate Master
        lcRating: 2420,
        lcBadge: "Guardian",
        ccRating: 2050, // 5-star
        easy: 220,
        medium: 310,
        hard: 105,
        unrated: 30,
        contests: 44,
        activeDays: 150,
        githubContributions: 890,
    },
    {
        username: "rohit_iitd",
        displayName: "Rohit Verma",
        email: "rohit@iitd.ac.in",
        college: "IIT Delhi",
        isVerified: false,
        streak: 22,
        cfRating: 1850, // Candidate Master
        lcRating: 2250,
        lcBadge: "Knight",
        ccRating: 1920, // 4-star
        easy: 210,
        medium: 280,
        hard: 85,
        unrated: 25,
        contests: 38,
        activeDays: 140,
        githubContributions: 620,
    },
    {
        username: "sophia_w",
        displayName: "Sophia Wang",
        email: "sophia@berkeley.edu",
        college: "UC Berkeley",
        isVerified: true,
        streak: 19,
        cfRating: 1740, // Expert
        lcRating: 2150,
        lcBadge: "Knight",
        easy: 195,
        medium: 260,
        hard: 70,
        unrated: 20,
        contests: 32,
        activeDays: 130,
        githubContributions: 750,
    },
    {
        username: "benchmark_user",
        displayName: "Benchmark Master",
        email: "benchmark@orbix.dev",
        college: "National University of Singapore",
        isVerified: true,
        streak: 14,
        cfRating: 1400, // Benchmark test case: CF 1400, 200 E, 150 M, 30 H, 20 C, 120 D -> 1630 pts
        easy: 200,
        medium: 150,
        hard: 30,
        unrated: 0,
        contests: 20,
        activeDays: 120,
        githubContributions: 0,
    },
    {
        username: "dev_siddharth",
        displayName: "Siddharth Rao",
        email: "sid@iiit.ac.in",
        college: "IIIT Hyderabad",
        isVerified: false,
        streak: 12,
        cfRating: 1580, // Specialist
        lcRating: 1980,
        lcBadge: "Knight",
        ccRating: 1720, // 3-star
        easy: 180,
        medium: 220,
        hard: 50,
        unrated: 15,
        contests: 26,
        activeDays: 110,
        githubContributions: 540,
    },
    {
        username: "marcus_k",
        displayName: "Marcus Krueger",
        email: "marcus@tum.de",
        college: "Technical University of Munich",
        isVerified: true,
        streak: 10,
        cfRating: 1620, // Expert
        lcRating: 1910,
        easy: 160,
        medium: 200,
        hard: 45,
        unrated: 10,
        contests: 24,
        activeDays: 105,
        githubContributions: 410,
    },
    {
        username: "ananya_g",
        displayName: "Ananya Gupta",
        email: "ananya@bits.ac.in",
        college: "BITS Pilani",
        isVerified: false,
        streak: 8,
        lcRating: 1840,
        ccRating: 1650,
        easy: 150,
        medium: 180,
        hard: 35,
        unrated: 10,
        contests: 18,
        activeDays: 95,
        githubContributions: 380,
    },
    {
        username: "lucas_silva",
        displayName: "Lucas Silva",
        email: "lucas@usp.br",
        college: "University of São Paulo",
        isVerified: true,
        streak: 7,
        cfRating: 1480, // Specialist
        easy: 140,
        medium: 160,
        hard: 25,
        unrated: 15,
        contests: 16,
        activeDays: 85,
        githubContributions: 290,
    },
    {
        username: "yuki_t",
        displayName: "Yuki Tanaka",
        email: "yuki@u-tokyo.ac.jp",
        college: "University of Tokyo",
        isVerified: true,
        streak: 5,
        acRating: 1650,
        easy: 130,
        medium: 140,
        hard: 20,
        unrated: 10,
        contests: 15,
        activeDays: 80,
        githubContributions: 320,
    },
    {
        username: "neha_k",
        displayName: "Neha Kulkarni",
        email: "neha@coep.ac.in",
        college: "COEP Tech",
        isVerified: false,
        streak: 3,
        lcRating: 1680,
        easy: 110,
        medium: 120,
        hard: 15,
        unrated: 5,
        contests: 10,
        activeDays: 60,
        githubContributions: 180,
    },
];

async function seed() {
    console.log("🌱 Initializing Database and Leaderboard Seed...");
    await testDatabaseConnection();

    const existingCountRes = await query("SELECT COUNT(*) FROM leaderboard_entries;");
    const existingCount = parseInt(existingCountRes.rows[0]?.count || "0", 10);
    console.log(`Current leaderboard_entries count: ${existingCount}`);

    const hashedPassword = await bcrypt.hash("Password@123", 10);

    for (const coder of SAMPLE_CODERS) {
        // Calculate platform ratings chips
        const platformRatings: Record<string, any> = {};
        if (coder.cfRating) {
            const tier = getCodeforcesTier(coder.cfRating);
            platformRatings.codeforces = { rating: coder.cfRating, tier: tier.name, color: tier.color };
        }
        if (coder.lcRating) {
            const tier = getLeetCodeTier(coder.lcRating, coder.lcBadge);
            platformRatings.leetcode = { rating: coder.lcRating, badge: tier.name, color: tier.color };
        }
        if (coder.ccRating) {
            const tier = getCodeChefTier(coder.ccRating);
            platformRatings.codechef = { rating: coder.ccRating, tier: tier.name, color: tier.color };
        }
        if (coder.acRating) {
            const tier = getAtCoderTier(coder.acRating);
            platformRatings.atcoder = { rating: coder.acRating, tier: tier.name, color: tier.color };
        }
        if (coder.tcRating) {
            platformRatings.topcoder = { rating: coder.tcRating, color: "#00aaff" };
        }

        // Calculate score with official engine
        const scoreResult = calculateOrbixScore({
            problems: {
                easy: coder.easy,
                medium: coder.medium,
                hard: coder.hard,
                unknownDifficulty: coder.unrated,
            },
            contests: {
                ratedContestsCount: coder.contests,
            },
            activity: {
                activeDaysCount: coder.activeDays,
                currentStreak: coder.streak,
            },
            ratings: {
                codeforces: coder.cfRating,
                leetcode: coder.lcRating,
                codechef: coder.ccRating,
                atcoder: coder.acRating,
                topcoder: coder.tcRating,
            },
            github: {
                contributions: coder.githubContributions,
            },
        });

        const totalSolved = coder.easy + coder.medium + coder.hard + coder.unrated;
        const totalContests = coder.contests;

        // 1. Upsert into users table
        const userUpsertRes = await query(
            `INSERT INTO users (
                username, firstName, lastName, email, password, termsAccepted,
                college, orbix_score, orbix_score_breakdown, orbix_score_version,
                orbix_score_updated_at, streak, total_solved, total_contests,
                platform_ratings, is_verified_coder, is_public
             ) VALUES (
                $1, $2, $3, $4, $5, true,
                $6, $7, $8, $9,
                CURRENT_TIMESTAMP, $10, $11, $12,
                $13, $14, true
             )
             ON CONFLICT (username) DO UPDATE SET
                firstName = EXCLUDED.firstName,
                lastName = EXCLUDED.lastName,
                college = EXCLUDED.college,
                orbix_score = EXCLUDED.orbix_score,
                orbix_score_breakdown = EXCLUDED.orbix_score_breakdown,
                orbix_score_version = EXCLUDED.orbix_score_version,
                orbix_score_updated_at = CURRENT_TIMESTAMP,
                streak = EXCLUDED.streak,
                total_solved = EXCLUDED.total_solved,
                total_contests = EXCLUDED.total_contests,
                platform_ratings = EXCLUDED.platform_ratings,
                is_verified_coder = EXCLUDED.is_verified_coder
             RETURNING id, username;`,
            [
                coder.username,
                coder.displayName.split(" ")[0] || coder.username,
                coder.displayName.split(" ").slice(1).join(" ") || "",
                coder.email,
                hashedPassword,
                coder.college,
                scoreResult.totalScore,
                JSON.stringify(scoreResult.breakdown),
                scoreResult.version,
                coder.streak,
                totalSolved,
                totalContests,
                JSON.stringify(platformRatings),
                coder.isVerified,
            ]
        );

        const userId = userUpsertRes.rows[0].id;

        // 2. Upsert into leaderboard_entries projection
        await query(
            `INSERT INTO leaderboard_entries (
                user_id, username, display_name, college, is_verified,
                score, score_breakdown, total_solved, total_contests,
                platform_ratings, streak, is_public, updated_at
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, true, CURRENT_TIMESTAMP
             )
             ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                display_name = EXCLUDED.display_name,
                college = EXCLUDED.college,
                is_verified = EXCLUDED.is_verified,
                score = EXCLUDED.score,
                score_breakdown = EXCLUDED.score_breakdown,
                total_solved = EXCLUDED.total_solved,
                total_contests = EXCLUDED.total_contests,
                platform_ratings = EXCLUDED.platform_ratings,
                streak = EXCLUDED.streak,
                updated_at = CURRENT_TIMESTAMP;`,
            [
                userId,
                coder.username,
                coder.displayName,
                coder.college,
                coder.isVerified,
                scoreResult.totalScore,
                JSON.stringify(scoreResult.breakdown),
                totalSolved,
                totalContests,
                JSON.stringify(platformRatings),
                coder.streak,
            ]
        );

        console.log(`✅ Seeded @${coder.username}: Score ${scoreResult.totalScore} pts (Solved: ${totalSolved}, Contests: ${totalContests}, Streak: ${coder.streak}d)`);
    }

    // Invalidate Redis cache
    await clearLeaderboardCache();

    // Verify seeded count and top 3
    const finalCountRes = await query("SELECT COUNT(*) FROM leaderboard_entries WHERE is_public = true;");
    console.log(`\n🎉 Final public leaderboard count: ${finalCountRes.rows[0].count}`);

    const top3Res = await query(`
        SELECT username, display_name, score, total_solved, streak, college
        FROM leaderboard_entries
        WHERE is_public = true
        ORDER BY score DESC, total_solved DESC, username ASC
        LIMIT 3;
    `);

    console.log("\n🏆 TOP 3 PODIUM:");
    top3Res.rows.forEach((r, idx) => {
        console.log(`  #${idx + 1}: ${r.display_name} (@${r.username}) - ${r.score} pts [${r.college}]`);
    });

    await pool.end();
    console.log("Database connection closed.");
}

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
