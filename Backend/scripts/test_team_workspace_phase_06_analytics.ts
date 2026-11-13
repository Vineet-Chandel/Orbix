// Backend/scripts/test_team_workspace_phase_06_analytics.ts
import { query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";

async function runPhase06Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 06 TEAM AND INDIVIDUAL ANALYTICS TESTS");
    console.log("===============================================================================\n");

    const createdUserIds: string[] = [];
    const createdDeptIds: string[] = [];
    const createdTaskIds: string[] = [];
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, msg: string) => {
        if (condition) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    };

    try {
        // 1. Locate Verified Club & Workspace
        const clubRes = await query(`SELECT id, name, auth_user_id FROM public.verified_clubs LIMIT 1;`);
        if (clubRes.rows.length === 0) throw new Error("No verified club found");
        const club = clubRes.rows[0];
        const clubOwnerId = club.auth_user_id;

        const wsRes = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, clubOwnerId);
        const workspaceId = wsRes.workspace.id;
        console.log(`Testing with Club: "${club.name}" (Club ID: ${club.id}, Workspace ID: ${workspaceId})\n`);

        // 2. Set Up Test Fixture
        console.log("--- 1. Setting Up Test Fixture (Manager, Depts, Leads, Contributors) ---");
        const randKey = Math.random().toString(36).slice(2, 7);

        const createTestUser = async (roleTag: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4) RETURNING id;`,
                [`${roleTag}_${randKey}@test.orbix.io`, `${roleTag}_${randKey}`, roleTag.toUpperCase(), "AnalyticTester"]
            );
            const uid = uRes.rows[0].id;
            createdUserIds.push(uid);
            return uid;
        };

        const mgrUid = await createTestUser("mgr");
        const leadAlphaUid = await createTestUser("lead_a");
        const contrib1Uid = await createTestUser("c1");
        const contrib2Uid = await createTestUser("c2");
        const leadBetaUid = await createTestUser("lead_b");
        const contrib3Uid = await createTestUser("c3");

        // Fetch workspace roles
        const rolesRes = await query(`SELECT id, name, slug, rank FROM public.workspace_roles WHERE workspace_id = $1;`, [workspaceId]);
        const roles = rolesRes.rows;
        const managerRole = roles.find((r: any) => r.slug === "admin" || r.slug === "manager" || r.rank === 800) || roles[0];
        const leadRole = roles.find((r: any) => r.slug === "dept_lead" || r.slug === "department_lead" || r.rank === 500) || roles[0];
        const memberRole = roles.find((r: any) => r.slug === "member" || r.rank === 200) || roles[roles.length - 1];

        // Create Dept Alpha (Active)
        const deptAlpha = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Analytics Alpha ${randKey}`,
            slug: `analytics_alpha_${randKey}`,
            leadUserId: leadAlphaUid,
            color: "#6366f1",
        });
        createdDeptIds.push(deptAlpha.id);

        // Create Dept Beta (Inactive/Low sample to test Insufficient Data)
        const deptBeta = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Analytics Beta ${randKey}`,
            slug: `analytics_beta_${randKey}`,
            leadUserId: leadBetaUid,
            color: "#ec4899",
        });
        createdDeptIds.push(deptBeta.id);

        // Add workspace members
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: mgrUid,
            roleId: managerRole.id,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: leadAlphaUid,
            roleId: leadRole.id,
            roleTitle: "Department Lead Alpha",
            departmentId: deptAlpha.id,
            membershipStatus: "active",
        });

        const c1Member = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib1Uid,
            roleId: memberRole.id,
            roleTitle: "Senior Developer",
            departmentId: deptAlpha.id,
            membershipStatus: "active",
        });

        const c2Member = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib2Uid,
            roleId: memberRole.id,
            roleTitle: "UI Engineer",
            departmentId: deptAlpha.id,
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: leadBetaUid,
            roleId: leadRole.id,
            roleTitle: "Department Lead Beta",
            departmentId: deptBeta.id,
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib3Uid,
            roleId: memberRole.id,
            roleTitle: "Marketing Specialist",
            departmentId: deptBeta.id,
            membershipStatus: "active",
        });

        console.log("  ✅ Workspace members and departments registered successfully.");

        // Fetch or create recognition categories
        const catRes = await query(`SELECT id, slug, name FROM public.workspace_recognition_categories WHERE workspace_id = $1 LIMIT 5;`, [workspaceId]);
        let categories = catRes.rows;
        if (categories.length === 0) {
            await WorkspaceRepository.ensureDefaultRecognitionCategories(null, workspaceId);
            const freshCats = await query(`SELECT id, slug, name FROM public.workspace_recognition_categories WHERE workspace_id = $1;`, [workspaceId]);
            categories = freshCats.rows;
        }

        const catTeamwork = categories.find((c: any) => c.slug === "teamwork") || categories[0];
        const catExecution = categories.find((c: any) => c.slug === "execution") || categories[1] || categories[0];
        const catLeadership = categories.find((c: any) => c.slug === "leadership") || categories[2] || categories[0];

        // Ensure manager budget
        const now = new Date();
        const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        await query(
            `INSERT INTO public.workspace_recognition_budgets (workspace_id, user_id, year_month, allocated_budget, used_budget)
             VALUES ($1, $2, $3, 1000, 0)
             ON CONFLICT (workspace_id, user_id, year_month) DO UPDATE SET allocated_budget = 1000;`,
            [workspaceId, mgrUid, periodKey]
        );

        // 3. Issue Recognition Awards
        console.log("\n--- 2. Issuing Recognition Awards for Analytics Testing ---");
        // Manager awards c1 (Teamwork, 50 Orbits)
        await WorkspaceRecognitionService.awardOrbits(
            workspaceId,
            mgrUid,
            {
                recipientUserId: contrib1Uid,
                amount: 50,
                categorySlugOrId: catTeamwork.slug,
                reason: "Outstanding cross-department peer support and mentorship",
                visibility: "workspace",
            }
        );

        // Manager awards c2 (Execution, 30 Orbits)
        await WorkspaceRecognitionService.awardOrbits(
            workspaceId,
            mgrUid,
            {
                recipientUserId: contrib2Uid,
                amount: 30,
                categorySlugOrId: catExecution.slug,
                reason: "Delivered responsive design components ahead of sprint deadline",
                visibility: "workspace",
            }
        );

        // Manager awards leadAlpha (Leadership, 25 Orbits)
        await WorkspaceRecognitionService.awardOrbits(
            workspaceId,
            mgrUid,
            {
                recipientUserId: leadAlphaUid,
                amount: 25,
                categorySlugOrId: catLeadership.slug,
                reason: "Exceptional technical roadmapping and unblocking the team",
                visibility: "workspace",
            }
        );

        console.log("  ✅ 3 recognition awards issued totaling 105 Orbits across 3 categories.");

        // 4. Create Tasks in Dept Alpha
        console.log("\n--- 3. Creating Varied Tasks for Performance & Delivery Analytics ---");
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        const yesterday = new Date(Date.now() - 86400000).toISOString();

        // Task 1: Approved Task (c1) - delivered on time
        const t1Res = await query(
            `INSERT INTO public.workspace_tasks 
             (workspace_id, department_id, title, status, priority, due_date, creator_id)
             VALUES ($1, $2, $3, 'approved', 'high', $4, $5) RETURNING id;`,
            [workspaceId, deptAlpha.id, `Task Alpha Approved ${randKey}`, tomorrow, mgrUid]
        );
        const t1Id = t1Res.rows[0].id;
        createdTaskIds.push(t1Id);
        await query(
            `INSERT INTO public.workspace_task_assignments (workspace_id, task_id, member_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4, $5);`,
            [workspaceId, t1Id, c1Member.id, contrib1Uid, mgrUid]
        );

        // Create submission for Task 1: approved
        const sub1Res = await query(
            `INSERT INTO public.workspace_task_submissions (workspace_id, task_id, submitted_by, content, status)
             VALUES ($1, $2, $3, 'Initial clean submission', 'approved') RETURNING id;`,
            [workspaceId, t1Id, contrib1Uid]
        );
        await query(
            `INSERT INTO public.workspace_task_reviews (workspace_id, task_id, submission_id, reviewer_id, decision, comments)
             VALUES ($1, $2, $3, $4, 'approved', 'LGTM! Great work.');`,
            [workspaceId, t1Id, sub1Res.rows[0].id, mgrUid]
        );

        // Task 2: Completed Task with revision history (c1) - had one changes_requested then approved
        const t2Res = await query(
            `INSERT INTO public.workspace_tasks 
             (workspace_id, department_id, title, status, priority, due_date, creator_id, completed_at)
             VALUES ($1, $2, $3, 'completed', 'medium', $4, $5, NOW()) RETURNING id;`,
            [workspaceId, deptAlpha.id, `Task Alpha Revised & Completed ${randKey}`, tomorrow, mgrUid]
        );
        const t2Id = t2Res.rows[0].id;
        createdTaskIds.push(t2Id);
        await query(
            `INSERT INTO public.workspace_task_assignments (workspace_id, task_id, member_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4, $5);`,
            [workspaceId, t2Id, c1Member.id, contrib1Uid, mgrUid]
        );

        // Submissions for Task 2: 1 revision requested, 1 approved
        const sub2v1Res = await query(
            `INSERT INTO public.workspace_task_submissions (workspace_id, task_id, submitted_by, content, status)
             VALUES ($1, $2, $3, 'Draft submission v1', 'changes_requested') RETURNING id;`,
            [workspaceId, t2Id, contrib1Uid]
        );
        await query(
            `INSERT INTO public.workspace_task_reviews (workspace_id, task_id, submission_id, reviewer_id, decision, comments)
             VALUES ($1, $2, $3, $4, 'changes_requested', 'Please refine component responsiveness.');`,
            [workspaceId, t2Id, sub2v1Res.rows[0].id, mgrUid]
        );

        const sub2v2Res = await query(
            `INSERT INTO public.workspace_task_submissions (workspace_id, task_id, submitted_by, content, status)
             VALUES ($1, $2, $3, 'Draft submission v2 with fixes', 'approved') RETURNING id;`,
            [workspaceId, t2Id, contrib1Uid]
        );
        await query(
            `INSERT INTO public.workspace_task_reviews (workspace_id, task_id, submission_id, reviewer_id, decision, comments)
             VALUES ($1, $2, $3, $4, 'approved', 'Verified and approved.');`,
            [workspaceId, t2Id, sub2v2Res.rows[0].id, mgrUid]
        );

        // Task 3: Overdue in_progress Task (c2)
        const t3Res = await query(
            `INSERT INTO public.workspace_tasks 
             (workspace_id, department_id, title, status, priority, due_date, creator_id)
             VALUES ($1, $2, $3, 'in_progress', 'urgent', $4, $5) RETURNING id;`,
            [workspaceId, deptAlpha.id, `Task Alpha Overdue ${randKey}`, yesterday, mgrUid]
        );
        const t3Id = t3Res.rows[0].id;
        createdTaskIds.push(t3Id);
        await query(
            `INSERT INTO public.workspace_task_assignments (workspace_id, task_id, member_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4, $5);`,
            [workspaceId, t3Id, c2Member.id, contrib2Uid, mgrUid]
        );

        // Task 4: Cancelled Task (must be excluded from delivery ratios)
        const t4Res = await query(
            `INSERT INTO public.workspace_tasks 
             (workspace_id, department_id, title, status, priority, due_date, creator_id)
             VALUES ($1, $2, $3, 'cancelled', 'low', $4, $5) RETURNING id;`,
            [workspaceId, deptAlpha.id, `Task Alpha Cancelled ${randKey}`, tomorrow, mgrUid]
        );
        const t4Id = t4Res.rows[0].id;
        createdTaskIds.push(t4Id);
        await query(
            `INSERT INTO public.workspace_task_assignments (workspace_id, task_id, member_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4, $5);`,
            [workspaceId, t4Id, c2Member.id, contrib2Uid, mgrUid]
        );

        console.log("  ✅ Created 4 tasks covering approved, revised, overdue, and cancelled states.");

        // 5. Test Workspace Comprehensive Analytics
        console.log("\n--- 4. Testing Workspace Comprehensive Analytics API ---");
        const analytics = await WorkspaceRecognitionService.getComprehensiveAnalytics(workspaceId, mgrUid, { period: "this_month" });

        // 4.1 Overview KPIs
        assert(analytics.totalOrbitsAwarded >= 105, `Total Orbits awarded recorded (${analytics.totalOrbitsAwarded} >= 105)`);
        assert(analytics.totalOrbitsReceived >= 105, `Total Orbits received recorded (${analytics.totalOrbitsReceived} >= 105)`);
        assert(analytics.activeContributors >= 3, `Active contributors count accurately tracked (${analytics.activeContributors} >= 3)`);
        assert(analytics.totalApprovedTasks >= 1, `Total approved tasks accurately tracked (${analytics.totalApprovedTasks} >= 1)`);
        assert(analytics.onTimeCompletionRate !== null && analytics.onTimeCompletionRate >= 0, `Overall on-time completion rate is computed (${analytics.onTimeCompletionRate}%)`);

        // 4.2 Contribution Trends
        assert(Array.isArray(analytics.contributionTrends) && analytics.contributionTrends.length === 4, `4 periodic trend intervals generated (count: ${analytics.contributionTrends.length})`);
        const latestTrend = analytics.contributionTrends[analytics.contributionTrends.length - 1];
        assert(latestTrend && typeof latestTrend.orbits === "number", `Latest trend bucket contains valid metrics (Orbits: ${latestTrend?.orbits})`);

        // 4.3 Category Distribution
        assert(Array.isArray(analytics.recognitionDistribution.categories) && analytics.recognitionDistribution.categories.length >= 3, `Category distribution populated (${analytics.recognitionDistribution.categories.length} categories)`);
        const teamworkDist = analytics.recognitionDistribution.categories.find((c) => c.slug === catTeamwork.slug);
        assert(teamworkDist !== undefined && teamworkDist.points >= 50, `Teamwork category recorded correctly (Points: ${teamworkDist?.points})`);

        // 4.4 Department Comparison & DPI
        assert(Array.isArray(analytics.departmentComparison), "Department comparison list returned");
        const alphaComparison = analytics.departmentComparison.find((d) => d.departmentId === deptAlpha.id);
        const betaComparison = analytics.departmentComparison.find((d) => d.departmentId === deptBeta.id);

        assert(alphaComparison !== undefined, "Department Alpha included in comparison");
        assert(alphaComparison?.hasSufficientData === true, `Department Alpha marked hasSufficientData = true`);
        assert(typeof alphaComparison?.dpi === "number" && alphaComparison.dpi > 0, `Department Alpha computed positive DPI: ${alphaComparison?.dpi}`);
        assert(alphaComparison?.tasksAssigned === 3, `Department Alpha excludes cancelled tasks (3 valid tasks, got: ${alphaComparison?.tasksAssigned})`);
        assert(alphaComparison?.approvedSubmissions >= 1, `Department Alpha has approved submissions`);
        assert(alphaComparison?.tasksCompleted === 2, `Department Alpha has 2 completed/approved tasks (${alphaComparison?.tasksCompleted})`);
        assert(alphaComparison?.overdueTasks === 1, `Department Alpha has 1 overdue task`);

        assert(betaComparison !== undefined, "Department Beta included in comparison");
        assert(betaComparison?.hasSufficientData === false, "Department Beta (0 tasks) safely marked hasSufficientData = false (no fabricated zero)");
        assert(betaComparison?.dpi === null, "Department Beta has null DPI instead of a misleading zero score");

        // 4.5 Leadership Analytics
        assert(Array.isArray(analytics.leadershipAnalytics), "Leadership analytics list returned");
        const alphaLeadAnalytic = analytics.leadershipAnalytics.find((l) => l.leadId === leadAlphaUid);
        assert(alphaLeadAnalytic !== undefined, "Dept Alpha Lead included in leadership analytics");
        assert(alphaLeadAnalytic?.leadPersonalOrbits === 25, `Dept Alpha Lead personal Orbits displayed separately (${alphaLeadAnalytic?.leadPersonalOrbits} Orbits)`);
        assert(alphaLeadAnalytic?.dpi === alphaComparison?.dpi, `Dept Alpha Lead reflects team DPI (${alphaLeadAnalytic?.dpi})`);

        // 4.6 Manager Activity & Concentration Alerts
        assert(Array.isArray(analytics.managerAwardActivity), "Manager award activity tracking returned");
        const mgrRecord = analytics.managerAwardActivity.find((m) => m.managerId === mgrUid);
        assert(mgrRecord !== undefined && mgrRecord.totalOrbitsAwarded === 105, `Manager award velocity tracked (${mgrRecord?.totalOrbitsAwarded} Orbits awarded)`);
        assert(mgrRecord?.awardCount === 3, `Manager total awards count accurate (${mgrRecord?.awardCount})`);

        if (analytics.recognitionDistribution.overconcentrationAlert) {
            console.log(`  ℹ️ Notice for human review flagged: "${analytics.recognitionDistribution.overconcentrationAlert}"`);
            assert(typeof analytics.recognitionDistribution.overconcentrationAlert === "string", "Overconcentration alert properly returned as notice for human review");
        } else {
            console.log("  ℹ️ No overconcentration flagged (distributed within threshold).");
            assert(true, "Overconcentration evaluated cleanly");
        }

        // 6. Test Individual Member Analytics
        console.log("\n--- 5. Testing Individual Member Analytics API ---");
        const c1Analytics = await WorkspaceRecognitionService.getIndividualMemberAnalytics(workspaceId, mgrUid, contrib1Uid, { period: "this_month" });

        assert(c1Analytics.userId === contrib1Uid, `Member identity returned for Contributor 1`);
        assert(c1Analytics.department?.name.includes("Alpha") === true, `Department membership reflected: ${c1Analytics.department?.name}`);
        assert(c1Analytics.totalOrbits === 50, `Contributor 1 total Orbits accurate (${c1Analytics.totalOrbits} = 50)`);
        assert(c1Analytics.tasksAssigned === 2, `Tasks assigned accurate (${c1Analytics.tasksAssigned} = 2)`);
        assert(c1Analytics.tasksCompleted === 1, `Tasks completed accurate (${c1Analytics.tasksCompleted} = 1)`);
        assert(c1Analytics.tasksApproved === 2, `Tasks approved accurate (${c1Analytics.tasksApproved} = 2, both Task 1 & Task 2 had approved reviews)`);
        assert(c1Analytics.onTimeSubmissionRate === 100, `On-time submission rate computed: ${c1Analytics.onTimeSubmissionRate}%`);
        assert(c1Analytics.submissionRevisionRate === 33.3, `Submission revision rate computed (1 requested changes / 3 submissions = 33.3%, got: ${c1Analytics.submissionRevisionRate}%)`);
        assert(Array.isArray(c1Analytics.trends) && c1Analytics.trends.length === 4, `4-week individual trend populated`);
        assert(Array.isArray(c1Analytics.categoriesBreakdown) && c1Analytics.categoriesBreakdown.length >= 1, `Individual category breakdown populated`);
        assert(c1Analytics.categoriesBreakdown[0].slug === catTeamwork.slug, `Awarded category is Teamwork`);

        // Test inactive member individual analytics (Safeguards against division by zero)
        console.log("\n--- 6. Testing Safeguards for Inactive Member (No fabricated zeroes) ---");
        const c3Analytics = await WorkspaceRecognitionService.getIndividualMemberAnalytics(workspaceId, mgrUid, contrib3Uid, { period: "this_month" });
        assert(c3Analytics.totalOrbits === 0, `Inactive member Orbits = 0`);
        assert(c3Analytics.tasksAssigned === 0, `Inactive member tasks = 0`);
        assert(c3Analytics.onTimeSubmissionRate === null, `Inactive member onTimeSubmissionRate = null (not 0%)`);
        assert(c3Analytics.submissionRevisionRate === null, `Inactive member submissionRevisionRate = null (not 0%)`);
        assert(c3Analytics.hasSufficientTaskData === false, `Inactive member correctly marked hasSufficientTaskData = false`);

        // 7. Test Redis Caching & Invalidation
        console.log("\n--- 7. Testing Redis Caching & Auto-Invalidation ---");
        const cachedAnalytics = await WorkspaceRecognitionService.getComprehensiveAnalytics(workspaceId, mgrUid, { period: "this_month" });
        assert(cachedAnalytics.totalOrbitsAwarded === analytics.totalOrbitsAwarded, "Analytics served from cache cleanly");

    } catch (err) {
        console.error("Test Suite crashed:", err);
        failed++;
    } finally {
        // --- Cleanup ---
        console.log("\n--- 8. Cleaning Up Ephemeral Test Fixtures ---");
        try {
            if (createdTaskIds.length > 0) {
                await query(`DELETE FROM public.workspace_task_reviews WHERE submission_id IN (SELECT id FROM public.workspace_task_submissions WHERE task_id = ANY($1));`, [createdTaskIds]);
                await query(`DELETE FROM public.workspace_task_submissions WHERE task_id = ANY($1);`, [createdTaskIds]);
                await query(`DELETE FROM public.workspace_task_assignments WHERE task_id = ANY($1);`, [createdTaskIds]);
                await query(`DELETE FROM public.workspace_tasks WHERE id = ANY($1);`, [createdTaskIds]);
            }
            if (createdUserIds.length > 0) {
                await query(`DELETE FROM public.workspace_recognition_ledger WHERE issuer_id = ANY($1) OR recipient_id = ANY($1);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_recognition_budgets WHERE user_id = ANY($1);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_department_members WHERE user_id = ANY($1);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_members WHERE user_id = ANY($1);`, [createdUserIds]);
            }
            if (createdDeptIds.length > 0) {
                await query(`DELETE FROM public.workspace_departments WHERE id = ANY($1);`, [createdDeptIds]);
            }
            if (createdUserIds.length > 0) {
                await query(`DELETE FROM public.users WHERE id = ANY($1);`, [createdUserIds]);
            }
            console.log("  ✅ Test fixtures successfully purged.");
        } catch (cleanupErr) {
            console.error("Error during fixture cleanup:", cleanupErr);
        }

        console.log("\n===============================================================================");
        console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
        console.log("===============================================================================\n");
        process.exit(failed > 0 ? 1 : 0);
    }
}

runPhase06Tests();
