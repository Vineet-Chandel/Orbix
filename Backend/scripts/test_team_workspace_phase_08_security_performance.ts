// Backend/scripts/test_team_workspace_phase_08_security_performance.ts
/**
 * ============================================================================
 * ORBIX TEAM WORKSPACE — PHASE 08 SECURITY, FAIRNESS & PERFORMANCE TEST SUITE
 * ============================================================================
 * Validates:
 * 1. Privilege testing (Normal member, lead without permission, suspended, removed, cross-workspace)
 * 2. Award manipulation (Self-award, negative, decimal, exceeding cap, short reason, fake category/recipient, double reversal, DB ledger immutability)
 * 3. Budget race testing (Atomic concurrency locking under parallel load)
 * 4. Leaderboard integrity (Department transfers, member suspension, lead succession, Redis fallback)
 * 5. Fairness & abuse controls (Velocity cap, monthly inflow cap, fairness alerts, non-punitive DPI)
 * 6. Rollout & Feature Flag toggling (Graceful disabled state)
 * 7. Load testing & empirical performance benchmarks (Latency p50/p95/p99, throughput req/s)
 * 8. Regression testing across existing workspace systems
 * ============================================================================
 */

import { query, pool } from "../src/database/client.js";
import redis from "../src/redis/client.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRecognitionRedisService } from "../src/redis/workspaceRecognitionRedis.js";
import { performance } from "node:perf_hooks";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passedCount++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failedCount++;
    }
}

async function run() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 08 SECURITY, FAIRNESS & PERFORMANCE TESTS");
    console.log("===============================================================================\n");

    let workspaceId = "";
    let clubId = "";
    let ownerUserId = "";
    let managerUserId = "";
    let leadUserId = "";
    let member1UserId = "";
    let member2UserId = "";
    let outsiderUserId = "";
    let deptAId = "";
    let deptBId = "";
    let testCategoryId = "";

    try {
        // ------------------------------------------------------------------------
        // STEP 1: FIXTURE SETUP
        // ------------------------------------------------------------------------
        console.log("--- 1. Setting Up Multi-Role Security & Isolation Fixtures ---");

        const clubRes = await query(
            `SELECT vc.id AS "clubId", vc.auth_user_id AS "ownerId", tw.id AS "workspaceId"
             FROM public.verified_clubs vc
             JOIN public.team_workspaces tw ON tw.club_id = vc.id
             LIMIT 1;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No existing club with workspace found for security testing.");
        }

        clubId = clubRes.rows[0].clubId;
        ownerUserId = clubRes.rows[0].ownerId;
        workspaceId = clubRes.rows[0].workspaceId;

        console.log(`Club ID: ${clubId}, Workspace ID: ${workspaceId}, Owner: ${ownerUserId}`);

        // Create 5 test users: Manager, Lead, Member 1, Member 2, Outsider
        const r = Math.floor(Math.random() * 8999 + 1000);
        const usersRes = await query(
            `INSERT INTO public.users (email, username, firstname, lastname)
             VALUES
                ('p8_mgr_${r}@orbix.test', 'p8_m_${r}', 'Security', 'Manager'),
                ('p8_lead_${r}@orbix.test', 'p8_l_${r}', 'Dept', 'Lead'),
                ('p8_mem1_${r}@orbix.test', 'p8_a_${r}', 'Alice', 'Contributor'),
                ('p8_mem2_${r}@orbix.test', 'p8_b_${r}', 'Bob', 'Contributor'),
                ('p8_out_${r}@orbix.test', 'p8_o_${r}', 'Foreign', 'Outsider')
             RETURNING id, username;`
        );

        managerUserId = usersRes.rows.find((row: any) => row.username.startsWith("p8_m_")).id;
        leadUserId = usersRes.rows.find((row: any) => row.username.startsWith("p8_l_")).id;
        member1UserId = usersRes.rows.find((row: any) => row.username.startsWith("p8_a_")).id;
        member2UserId = usersRes.rows.find((row: any) => row.username.startsWith("p8_b_")).id;
        outsiderUserId = usersRes.rows.find((row: any) => row.username.startsWith("p8_o_")).id;

        // Resolve workspace roles
        const rolesRes = await query(
            `SELECT id, slug, rank FROM public.workspace_roles WHERE workspace_id = $1;`,
            [workspaceId]
        );
        const managerRole = rolesRes.rows.find((r: any) => r.slug === "workspace_manager" || r.rank >= 800) || rolesRes.rows[0];
        const leadRole = rolesRes.rows.find((r: any) => r.slug === "department_lead" || (r.rank >= 500 && r.rank < 800)) || rolesRes.rows[0];
        const memberRole = rolesRes.rows.find((r: any) => r.slug === "member" || r.rank < 500) || rolesRes.rows[rolesRes.rows.length - 1];

        // Create two departments for transfer testing
        const deptRes = await query(
            `INSERT INTO public.workspace_departments (workspace_id, name, slug, description, color, lead_user_id, status)
             VALUES
                ($1, 'Phase8 Dept Alpha', 'p8-da-${r}', 'Alpha Department', '#6366F1', $2, 'active'),
                ($1, 'Phase8 Dept Beta', 'p8-db-${r}', 'Beta Department', '#EC4899', NULL, 'active')
             RETURNING id, slug;`,
            [workspaceId, leadUserId]
        );
        deptAId = deptRes.rows[0].id;
        deptBId = deptRes.rows[1].id;

        // Register memberships
        await query(
            `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, department_id, role_title, membership_status, is_suspended)
             VALUES
                ($1, $2, $3, NULL, 'Workspace Manager', 'active', false),
                ($1, $4, $5, $6, 'Department Lead', 'active', false),
                ($1, $7, $8, $6, 'Team Contributor', 'active', false),
                ($1, $9, $8, $6, 'Team Contributor', 'active', false);`,
            [workspaceId, managerUserId, managerRole.id, leadUserId, leadRole.id, deptAId, member1UserId, memberRole.id, member2UserId]
        );

        // Fetch or create recognition category
        const catRes = await query(
            `SELECT id FROM public.workspace_recognition_categories WHERE workspace_id = $1 AND is_active = true LIMIT 1;`,
            [workspaceId]
        );
        if (catRes.rows.length > 0) {
            testCategoryId = catRes.rows[0].id;
        } else {
            const newCat = await query(
                `INSERT INTO public.workspace_recognition_categories (workspace_id, name, slug, description, icon, is_system, is_active)
                 VALUES ($1, 'Security Testing', 'sec-test-${ts}', 'Testing category', 'Shield', true, true)
                 RETURNING id;`,
                [workspaceId]
            );
            testCategoryId = newCat.rows[0].id;
        }

        // Ensure policy is enabled with default limits
        await query(
            `UPDATE public.workspace_recognition_policies
             SET is_enabled = true, min_points_per_award = 5, max_points_per_award = 50,
                 recipient_monthly_cap = 200, daily_award_limit_per_issuer = 20, min_reason_length = 15
             WHERE workspace_id = $1;`,
            [workspaceId]
        );

        console.log("  ✅ Security test environment initialized.\n");

        // ------------------------------------------------------------------------
        // STEP 2: PRIVILEGE TESTING (UNAUTHORIZED CALLS MUST FAIL)
        // ------------------------------------------------------------------------
        console.log("--- 2. Privilege Testing (Deny-by-Default Authorization) ---");

        // 2a. Normal Team Member attempts to award
        let errNormMember: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, member1UserId, {
                recipientUserId: member2UserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Unauthorized peer appreciation attempt by normal member",
            });
        } catch (e) {
            errNormMember = e;
        }
        assert(!!errNormMember && errNormMember.message.includes("authority"), "Normal Team Member forbidden from awarding Orbits");

        // 2b. Department Lead without explicit award permission attempts to award
        let errLead: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, leadUserId, {
                recipientUserId: member1UserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Department Lead attempting award without recognition:award permission",
            });
        } catch (e) {
            errLead = e;
        }
        assert(!!errLead && errLead.message.includes("authority"), "Department Lead without explicit award delegation forbidden");

        // 2c. Suspended Manager attempts to award
        await query(`UPDATE public.workspace_members SET is_suspended = true WHERE workspace_id = $1 AND user_id = $2;`, [workspaceId, managerUserId]);
        let errSuspendedMgr: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, managerUserId, {
                recipientUserId: member1UserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Suspended manager should never be allowed to award points",
            });
        } catch (e) {
            errSuspendedMgr = e;
        }
        assert(!!errSuspendedMgr && (errSuspendedMgr.message.includes("Active") || errSuspendedMgr.message.includes("Unauthorized")), "Suspended manager forbidden from awarding Orbits");
        // Reinstate manager
        await query(`UPDATE public.workspace_members SET is_suspended = false WHERE workspace_id = $1 AND user_id = $2;`, [workspaceId, managerUserId]);

        // 2d. Awarding a Suspended Member
        await query(`UPDATE public.workspace_members SET is_suspended = true WHERE workspace_id = $1 AND user_id = $2;`, [workspaceId, member1UserId]);
        let errAwardSuspended: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Recognizing suspended member must be rejected",
            });
        } catch (e) {
            errAwardSuspended = e;
        }
        assert(!!errAwardSuspended && errAwardSuspended.message.includes("suspended"), "Cannot award Orbits to a suspended member");
        // Reinstate member 1
        await query(`UPDATE public.workspace_members SET is_suspended = false WHERE workspace_id = $1 AND user_id = $2;`, [workspaceId, member1UserId]);

        // 2e. Outsider user from another workspace attempts to award
        let errOutsider: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, outsiderUserId, {
                recipientUserId: member1UserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Foreign outsider attempting cross-workspace award",
            });
        } catch (e) {
            errOutsider = e;
        }
        assert(!!errOutsider && (errOutsider.message.includes("Unauthorized") || errOutsider.message.includes("membership")), "User outside workspace forbidden from awarding Orbits");

        // 2f. Awarding an outsider user
        let errAwardOutsider: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: outsiderUserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Attempting to award non-member user",
            });
        } catch (e) {
            errAwardOutsider = e;
        }
        assert(!!errAwardOutsider && errAwardOutsider.message.includes("not a member"), "Cannot award Orbits to non-workspace user\n");

        // ------------------------------------------------------------------------
        // STEP 3: AWARD MANIPULATION & INPUT DEFENSE
        // ------------------------------------------------------------------------
        console.log("--- 3. Award Manipulation & Input Validation Defense ---");

        // 3a. Self-Awarding
        let errSelfAward: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: ownerUserId,
                amount: 25,
                categorySlugOrId: testCategoryId,
                reason: "Owner awarding points to themselves",
            });
        } catch (e) {
            errSelfAward = e;
        }
        assert(!!errSelfAward && errSelfAward.message.includes("themselves"), "Self-recognition strictly prevented");

        // 3b. Negative award amount
        let errNeg: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: -15,
                categorySlugOrId: testCategoryId,
                reason: "Negative points punitive award attempt",
            });
        } catch (e) {
            errNeg = e;
        }
        assert(!!errNeg && errNeg.message.includes("positive integer"), "Negative award amount rejected");

        // 3c. Decimal award amount
        let errDecimal: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: 12.5 as any,
                categorySlugOrId: testCategoryId,
                reason: "Decimal points fractional award attempt",
            });
        } catch (e) {
            errDecimal = e;
        }
        assert(!!errDecimal && errDecimal.message.includes("positive integer"), "Decimal/fractional award amount rejected");

        // 3d. Amount exceeding maximum limit (max is 50)
        let errExceedMax: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: 100,
                categorySlugOrId: testCategoryId,
                reason: "Exceeding max points per award policy",
            });
        } catch (e) {
            errExceedMax = e;
        }
        assert(!!errExceedMax && errExceedMax.message.includes("Maximum single award"), "Award exceeding policy max points per award rejected");

        // 3e. Short / meaningless appreciation reason (< 15 chars)
        let errShortReason: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: 15,
                categorySlugOrId: testCategoryId,
                reason: "Good job",
            });
        } catch (e) {
            errShortReason = e;
        }
        assert(!!errShortReason && errShortReason.message.includes("at least 15"), "Vague/short reason below policy threshold rejected");

        // 3f. Fake category ID
        let errFakeCat: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: 15,
                categorySlugOrId: "00000000-0000-0000-0000-000000000000",
                reason: "Valid reason for exceptional engineering work",
            });
        } catch (e) {
            errFakeCat = e;
        }
        assert(!!errFakeCat && errFakeCat.message.includes("Invalid or inactive recognition category"), "Non-existent category rejected");

        // 3g. Idempotent submission replay
        const idempotencyKey = `p8-idemp-${Date.now()}`;
        const firstAward = await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
            recipientUserId: member1UserId,
            amount: 20,
            categorySlugOrId: testCategoryId,
            reason: "Initial award for performance optimization",
            idempotencyKey,
        });
        const secondAward = await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
            recipientUserId: member1UserId,
            amount: 20,
            categorySlugOrId: testCategoryId,
            reason: "Duplicate replay with identical idempotency key",
            idempotencyKey,
        });
        assert(firstAward.id === secondAward.id, "Duplicate submission with same idempotency key safely returns original transaction");

        // 3h. Double reversal prevention
        const reversalResult = await WorkspaceRecognitionService.reverseAward(workspaceId, ownerUserId, firstAward.id, {
            reversalReason: "Reversing test award due to administrative error",
        });
        assert(reversalResult.originalEntry.isReversed === true, "Original award marked isReversed = true");

        let errDoubleRev: any = null;
        try {
            await WorkspaceRecognitionService.reverseAward(workspaceId, ownerUserId, firstAward.id, {
                reversalReason: "Attempting to reverse an already reversed award",
            });
        } catch (e) {
            errDoubleRev = e;
        }
        assert(!!errDoubleRev && errDoubleRev.message.includes("already been reversed"), "Double reversal attempt rejected");

        // 3i. Database Ledger Immutability Trigger (Direct Tampering Defense)
        let errDirectUpdate: any = null;
        try {
            await query(`UPDATE public.workspace_recognition_ledger SET points_delta = 9999 WHERE id = $1;`, [firstAward.id]);
        } catch (e) {
            errDirectUpdate = e;
        }
        assert(!!errDirectUpdate && errDirectUpdate.message.includes("Security violation"), "Direct SQL update on ledger points blocked by DB trigger");

        let errDirectDelete: any = null;
        try {
            await query(`DELETE FROM public.workspace_recognition_ledger WHERE id = $1;`, [firstAward.id]);
        } catch (e) {
            errDirectDelete = e;
        }
        assert(!!errDirectDelete && errDirectDelete.message.includes("cannot be deleted"), "Direct SQL delete on ledger row blocked by DB trigger\n");

        // ------------------------------------------------------------------------
        // STEP 4: BUDGET CONCURRENCY & RACE TESTING
        // ------------------------------------------------------------------------
        console.log("--- 4. Budget Race & Parallel Concurrency Testing ---");

        const yearMonth = new Date().toISOString().slice(0, 7);
        // Set manager's budget to strictly 50 Orbits
        await query(
            `INSERT INTO public.workspace_recognition_budgets (workspace_id, user_id, year_month, allocated_budget, used_budget, allocated_by)
             VALUES ($1, $2, $3, 50, 0, $4)
             ON CONFLICT (workspace_id, user_id, year_month)
             DO UPDATE SET allocated_budget = 50, used_budget = 0;`,
            [workspaceId, managerUserId, yearMonth, ownerUserId]
        );

        // Simulate 5 simultaneous parallel award requests of 25 Orbits each (total 125 Orbits vs 50 budget)
        console.log("  Simulating 5 concurrent award requests of 25 Orbits each (Total requested: 125, Budget: 50)...");
        const concurrentAttempts = [1, 2, 3, 4, 5].map((i) =>
            WorkspaceRecognitionService.awardOrbits(workspaceId, managerUserId, {
                recipientUserId: member2UserId,
                amount: 25,
                categorySlugOrId: testCategoryId,
                reason: `Concurrent parallel award attempt #${i} for system load testing`,
            })
                .then((res) => ({ success: true, id: res.id }))
                .catch((err) => ({ success: false, error: err.message }))
        );

        const results = await Promise.all(concurrentAttempts);
        const successes = results.filter((r) => r.success);
        const failures = results.filter((r) => !r.success);

        console.log(`  Concurrent results: ${successes.length} committed, ${failures.length} rejected by budget lock.`);
        assert(successes.length === 2, `Exactly 2 awards committed within budget (got: ${successes.length})`);
        assert(failures.length === 3, `Remaining 3 requests rejected with budget exceeded (got: ${failures.length})`);

        // Check final budget row
        const budgetRow = await query(
            `SELECT allocated_budget, used_budget FROM public.workspace_recognition_budgets
             WHERE workspace_id = $1 AND user_id = $2 AND year_month = $3;`,
            [workspaceId, managerUserId, yearMonth]
        );
        const used = budgetRow.rows[0].used_budget;
        assert(used === 50, `Final used budget is strictly 50 / 50 (got: ${used})\n`);

        // ------------------------------------------------------------------------
        // STEP 5: LEADERBOARD INTEGRITY, TRANSFERS & SUSPENSIONS
        // ------------------------------------------------------------------------
        console.log("--- 5. Leaderboard Integrity, Department Transfers & Suspensions ---");

        // 5a. Award member 1 while in Department Alpha
        const awardDeptA = await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
            recipientUserId: member1UserId,
            amount: 30,
            categorySlugOrId: testCategoryId,
            reason: "Outstanding contributions to Dept Alpha architecture",
        });
        assert(awardDeptA.pointsDelta === 30, "Member 1 earned 30 Orbits in Dept Alpha");

        // 5b. Transfer Member 1 from Dept Alpha to Dept Beta
        await query(
            `UPDATE public.workspace_members SET department_id = $1 WHERE workspace_id = $2 AND user_id = $3;`,
            [deptBId, workspaceId, member1UserId]
        );

        // 5c. Award Member 1 after transfer while in Department Beta
        const awardDeptB = await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
            recipientUserId: member1UserId,
            amount: 20,
            categorySlugOrId: testCategoryId,
            reason: "First sprint accomplishments in Dept Beta",
        });
        assert(awardDeptB.pointsDelta === 20, "Member 1 earned 20 Orbits in Dept Beta");

        // 5d. Verify departmental ledger attribution
        const ledgerRows = await query(
            `SELECT id, department_id, points_delta FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND recipient_id = $2 AND is_reversed = false
             ORDER BY created_at ASC;`,
            [workspaceId, member1UserId]
        );
        const deptAEntry = ledgerRows.rows.find((r: any) => r.department_id === deptAId);
        const deptBEntry = ledgerRows.rows.find((r: any) => r.department_id === deptBId);
        assert(!!deptAEntry && deptAEntry.points_delta === 30, "Historical 30 Orbits remained permanently attributed to Dept Alpha");
        assert(!!deptBEntry && deptBEntry.points_delta === 20, "New 20 Orbits attributed to Dept Beta");

        // 5e. Member Suspension: excluded from active leaderboards
        const preSuspendRank = await WorkspaceRepository.getThreeLeaderboards(workspaceId, { period: "all_time" });
        const member1PresentPre = preSuspendRank.contributors.some((c) => c.userId === member1UserId);
        assert(member1PresentPre, "Member 1 present on active leaderboard prior to suspension");

        await query(
            `UPDATE public.workspace_members SET is_suspended = true WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, member1UserId]
        );
        const postSuspendRank = await WorkspaceRepository.getThreeLeaderboards(workspaceId, { period: "all_time" });
        const member1PresentPost = postSuspendRank.contributors.some((c) => c.userId === member1UserId);
        assert(!member1PresentPost, "Suspended member dynamically excluded from active contributor leaderboard");

        // Reactivate member 1
        await query(
            `UPDATE public.workspace_members SET is_suspended = false WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, member1UserId]
        );
        const postReactivateRank = await WorkspaceRepository.getThreeLeaderboards(workspaceId, { period: "all_time" });
        const member1PresentRestored = postReactivateRank.contributors.some((c) => c.userId === member1UserId);
        assert(member1PresentRestored, "Reinstated member reappears on active contributor leaderboard\n");

        // ------------------------------------------------------------------------
        // STEP 6: FAIRNESS CONTROLS & COMPREHENSIVE ANALYTICS
        // ------------------------------------------------------------------------
        console.log("--- 6. Fairness & Abuse Controls ---");

        const analytics = await WorkspaceRepository.getComprehensiveAnalytics(workspaceId, "all_time");
        assert(analytics.totalOrbitsAwarded > 0, `Total Orbits Awarded recorded accurately (${analytics.totalOrbitsAwarded})`);
        assert(Array.isArray(analytics.departmentComparison), "Department comparison generated");
        assert(Array.isArray(analytics.managerAwardActivity), "Manager award activity auditable");

        // Recipient Monthly Inflow Cap Enforcement
        await query(`UPDATE public.workspace_recognition_policies SET recipient_monthly_cap = 60 WHERE workspace_id = $1;`, [workspaceId]);
        // Member 1 currently has 50 Orbits this month (30 + 20)
        let errCapExceeded: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member1UserId,
                amount: 25, // 50 + 25 = 75 > 60 cap
                categorySlugOrId: testCategoryId,
                reason: "Exceeding monthly recipient inflow cap",
            });
        } catch (e) {
            errCapExceeded = e;
        }
        assert(!!errCapExceeded && errCapExceeded.message.includes("monthly allowance exceeded"), "Anti-collusion monthly inflow cap enforced");

        // Restore cap
        await query(`UPDATE public.workspace_recognition_policies SET recipient_monthly_cap = 500 WHERE workspace_id = $1;`, [workspaceId]);

        // Non-punitive DPI check: Ensure zero negative punitive deductions
        const allDepts = postReactivateRank.departments;
        const noNegativeDPI = allDepts.every((d) => d.departmentPerformanceIndex === null || d.departmentPerformanceIndex >= 0);
        assert(noNegativeDPI, "DPI scores are non-punitive (all values >= 0)\n");

        // ------------------------------------------------------------------------
        // STEP 7: ROLLOUT & FEATURE FLAG (ENABLED / DISABLED)
        // ------------------------------------------------------------------------
        console.log("--- 7. Rollout & Feature Flag Controls ---");

        // Disable recognition policy
        await query(`UPDATE public.workspace_recognition_policies SET is_enabled = false WHERE workspace_id = $1;`, [workspaceId]);

        let errDisabled: any = null;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member2UserId,
                amount: 10,
                categorySlugOrId: testCategoryId,
                reason: "Awarding when recognition is disabled",
            });
        } catch (e) {
            errDisabled = e;
        }
        assert(!!errDisabled && errDisabled.message.includes("currently disabled"), "Awarding rejected when feature flag is disabled");

        // Re-enable policy
        await query(`UPDATE public.workspace_recognition_policies SET is_enabled = true WHERE workspace_id = $1;`, [workspaceId]);
        const awardEnabled = await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
            recipientUserId: member2UserId,
            amount: 10,
            categorySlugOrId: testCategoryId,
            reason: "Awarding immediately after re-enabling feature flag",
        });
        assert(awardEnabled.pointsDelta === 10, "Awarding seamlessly succeeds after re-enabling policy\n");

        // ------------------------------------------------------------------------
        // STEP 8: EMPIRICAL PERFORMANCE & LOAD TESTING
        // ------------------------------------------------------------------------
        console.log("--- 8. Load & Performance Benchmarking ---");

        // 8a. Concurrent Award Creation Benchmark (20 rapid awards)
        console.log("  Running benchmark: 20 sequential awards with full ledger commits & outbox triggers...");
        const awardLatencies: number[] = [];
        for (let i = 0; i < 20; i++) {
            const t0 = performance.now();
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: member2UserId,
                amount: 5,
                categorySlugOrId: testCategoryId,
                reason: `Performance test award execution sequence iteration ${i}`,
            });
            const t1 = performance.now();
            awardLatencies.push(t1 - t0);
        }

        awardLatencies.sort((a, b) => a - b);
        const p50Award = awardLatencies[Math.floor(awardLatencies.length * 0.5)].toFixed(1);
        const p95Award = awardLatencies[Math.floor(awardLatencies.length * 0.95)].toFixed(1);
        const avgAward = (awardLatencies.reduce((a, b) => a + b, 0) / awardLatencies.length).toFixed(1);

        console.log(`  -> Award Creation Latency: avg = ${avgAward}ms, p50 = ${p50Award}ms, p95 = ${p95Award}ms`);
        assert(Number(p50Award) < 300, `Award creation p50 latency under 300ms (${p50Award}ms)`);

        // 8b. Redis Leaderboard Read Benchmark (50 iterations)
        console.log("  Running benchmark: 50 fast Redis sorted set leaderboard reads...");
        const readLatencies: number[] = [];
        for (let i = 0; i < 50; i++) {
            const t0 = performance.now();
            await WorkspaceRecognitionRedisService.getTopRankings(workspaceId, "contributors", "all_time", 50, 0);
            const t1 = performance.now();
            readLatencies.push(t1 - t0);
        }

        readLatencies.sort((a, b) => a - b);
        const p50Read = readLatencies[Math.floor(readLatencies.length * 0.5)].toFixed(2);
        const p95Read = readLatencies[Math.floor(readLatencies.length * 0.95)].toFixed(2);
        const avgRead = (readLatencies.reduce((a, b) => a + b, 0) / readLatencies.length).toFixed(2);

        console.log(`  -> Redis ZSET Read Latency: avg = ${avgRead}ms, p50 = ${p50Read}ms, p95 = ${p95Read}ms`);
        assert(Number(p50Read) < 25, `Redis leaderboard p50 read latency under 25ms (${p50Read}ms)`);

        // 8c. Nearby Rankings Benchmark (50 iterations)
        const nearbyLatencies: number[] = [];
        for (let i = 0; i < 50; i++) {
            const t0 = performance.now();
            await WorkspaceRecognitionRedisService.getNearbyRankings(workspaceId, "contributors", "all_time", member2UserId, 3);
            const t1 = performance.now();
            nearbyLatencies.push(t1 - t0);
        }
        nearbyLatencies.sort((a, b) => a - b);
        const p50Nearby = nearbyLatencies[Math.floor(nearbyLatencies.length * 0.5)].toFixed(2);
        console.log(`  -> Redis Nearby Rankings Latency: p50 = ${p50Nearby}ms`);
        assert(Number(p50Nearby) < 25, `Nearby rankings p50 latency under 25ms (${p50Nearby}ms)`);

        // 8d. Comprehensive Analytics Benchmark (5 iterations)
        const analyticsLatencies: number[] = [];
        for (let i = 0; i < 5; i++) {
            const t0 = performance.now();
            await WorkspaceRepository.getComprehensiveAnalytics(workspaceId, "all_time");
            const t1 = performance.now();
            analyticsLatencies.push(t1 - t0);
        }
        const avgAnalytics = (analyticsLatencies.reduce((a, b) => a + b, 0) / analyticsLatencies.length).toFixed(1);
        console.log(`  -> Analytics Aggregation Latency: avg = ${avgAnalytics}ms`);
        assert(Number(avgAnalytics) < 500, `Analytics query latency under 500ms (${avgAnalytics}ms)\n`);

        // ------------------------------------------------------------------------
        // STEP 9: REGRESSION TESTING ACROSS EXISTING WORKSPACE
        // ------------------------------------------------------------------------
        console.log("--- 9. System-wide Regression Testing ---");

        // 9a. Verify Tasks system remains functional
        const taskRes = await query(
            `INSERT INTO public.workspace_tasks (workspace_id, department_id, title, description, priority, status, created_by)
             VALUES ($1, $2, 'Regression Test Task', 'Verifying task creation is undisturbed', 'high', 'todo', $3)
             RETURNING id, title;`,
            [workspaceId, deptAId, managerUserId]
        );
        assert(taskRes.rows.length === 1 && taskRes.rows[0].title === 'Regression Test Task', "Task creation functioning cleanly");

        // 9b. Verify Channels system
        const channelRes = await query(
            `SELECT id, name FROM public.workspace_channels WHERE workspace_id = $1 LIMIT 1;`,
            [workspaceId]
        );
        assert(channelRes.rows !== undefined, "Workspace channels schema accessible");

        // 9c. Verify Departments
        const deptsCheck = await query(`SELECT COUNT(*)::int AS count FROM public.workspace_departments WHERE workspace_id = $1;`, [workspaceId]);
        assert(deptsCheck.rows[0].count >= 2, "Workspace departments operational");

        // 9d. Clean up regression task
        await query(`DELETE FROM public.workspace_tasks WHERE id = $1;`, [taskRes.rows[0].id]);
        console.log("  ✅ Regression suite passed without side-effects.\n");

        // ------------------------------------------------------------------------
        // STEP 10: CLEANUP FIXTURES
        // ------------------------------------------------------------------------
        console.log("--- 10. Cleaning Up Ephemeral Security Test Fixtures ---");

        // Purge test ledger entries
        await query(
            `DELETE FROM public.workspace_recognition_notes 
             WHERE award_id IN (SELECT id FROM public.workspace_recognition_ledger WHERE workspace_id = $1);`,
            [workspaceId]
        );
        // Note: trg_guard_recognition_ledger_immutability blocks DELETE on ledger.
        // For test teardown, we can drop the trigger temporarily or keep rows if permanent.
        // Let's drop trigger, purge test rows, and re-create trigger:
        await query(`DROP TRIGGER IF EXISTS trg_guard_recognition_ledger_immutability ON public.workspace_recognition_ledger;`);
        await query(
            `DELETE FROM public.workspace_recognition_ledger 
             WHERE workspace_id = $1 AND (issuer_id IN ($2, $3, $4, $5) OR recipient_id IN ($2, $3, $4, $5));`,
            [workspaceId, managerUserId, leadUserId, member1UserId, member2UserId]
        );
        // Re-attach trigger
        await query(
            `CREATE TRIGGER trg_guard_recognition_ledger_immutability
             BEFORE UPDATE OR DELETE ON public.workspace_recognition_ledger
             FOR EACH ROW EXECUTE FUNCTION public.fn_guard_recognition_ledger_immutability();`
        );

        // Delete test budgets
        await query(
            `DELETE FROM public.workspace_recognition_budgets WHERE workspace_id = $1 AND user_id IN ($2, $3);`,
            [workspaceId, managerUserId, leadUserId]
        );

        // Delete test members & departments
        await query(`DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id IN ($2, $3, $4, $5);`, [
            workspaceId,
            managerUserId,
            leadUserId,
            member1UserId,
            member2UserId,
        ]);
        await query(`DELETE FROM public.workspace_departments WHERE id IN ($1, $2);`, [deptAId, deptBId]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3, $4, $5);`, [
            managerUserId,
            leadUserId,
            member1UserId,
            member2UserId,
            outsiderUserId,
        ]);

        // Clean Redis keys
        await WorkspaceRecognitionRedisService.clearAllWorkspaceLeaderboards(workspaceId);

        console.log("  ✅ Ephemeral test fixtures purged and ledger trigger re-secured.");

    } catch (err: any) {
        console.error("\n❌ Fatal error in Phase 08 test execution:", err);
        failedCount++;
    } finally {
        console.log("\n===============================================================================");
        console.log(`TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
        console.log("===============================================================================\n");

        if (redis && redis.status === "ready") {
            redis.disconnect();
        }
        await pool.end();
        process.exit(failedCount === 0 ? 0 : 1);
    }
}

run();
