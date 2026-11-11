// Backend/scripts/test_team_workspace_phase_05_three_leaderboards.ts
import { query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";

async function runPhase05Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 05 THREE LEADERBOARDS TESTS");
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
        // Find existing verified club
        const clubRes = await query(`SELECT id, name, auth_user_id FROM public.verified_clubs LIMIT 1;`);
        if (clubRes.rows.length === 0) throw new Error("No verified club found");
        const club = clubRes.rows[0];
        const clubOwnerId = club.auth_user_id;

        const wsRes = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, clubOwnerId);
        const workspaceId = wsRes.workspace.id;
        console.log(`Auditing Club: "${club.name}" (Club ID: ${club.id}, Workspace ID: ${workspaceId})\n`);

        // --- 1. Setting Up Test Fixture: Manager, 2 Dept Leads (co-leads), 3 Contributors ---
        console.log("--- 1. Setting Up Test Fixture (Manager, 2 Depts, Co-leads, 3 Contributors) ---");
        const randKey = Math.random().toString(36).slice(2, 7);

        // Helper to create test user
        const createTestUser = async (roleTag: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4) RETURNING id;`,
                [`${roleTag}_${randKey}@test.orbix.io`, `${roleTag}_${randKey}`, roleTag.toUpperCase(), "Tester"]
            );
            const uid = uRes.rows[0].id;
            createdUserIds.push(uid);
            return uid;
        };

        const managerUid = await createTestUser("mgr");
        const leadAlphaUid = await createTestUser("lead_a");
        const coLeadAlphaUid = await createTestUser("colead_a");
        const contrib1Uid = await createTestUser("c1");
        const contrib2Uid = await createTestUser("c2");
        const contrib3Uid = await createTestUser("c3");

        // Roles
        const rolesRes = await query(`SELECT id, name, slug, rank FROM public.workspace_roles WHERE workspace_id = $1;`, [workspaceId]);
        const roles = rolesRes.rows;
        const managerRole = roles.find((r: any) => r.slug === "admin" || r.slug === "manager" || r.rank === 800) || roles[0];
        const leadRole = roles.find((r: any) => r.slug === "dept_lead" || r.slug === "department_lead" || r.rank === 500) || roles[0];
        const memberRole = roles.find((r: any) => r.slug === "member" || r.rank === 200) || roles[roles.length - 1];

        // Create Department 1: Engineering (Active with tasks)
        const dept1 = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Dept Alpha ${randKey}`,
            slug: `alpha_${randKey}`,
            leadUserId: leadAlphaUid,
            coLeadUserIds: [coLeadAlphaUid],
            color: "#6366f1",
        });
        createdDeptIds.push(dept1.id);

        // Create Department 2: Marketing (Empty / No Activity to test Insufficient Data)
        const dept2 = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Dept Beta Empty ${randKey}`,
            slug: `beta_${randKey}`,
            color: "#ec4899",
        });
        createdDeptIds.push(dept2.id);

        // Add members to workspace
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: managerUid,
            roleId: managerRole.id,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: leadAlphaUid,
            roleId: leadRole.id,
            departmentId: dept1.id,
            roleTitle: "Department Lead",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: coLeadAlphaUid,
            roleId: leadRole.id,
            departmentId: dept1.id,
            roleTitle: "Department Co-Lead",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib1Uid,
            roleId: memberRole.id,
            departmentId: dept1.id,
            roleTitle: "Software Engineer",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib2Uid,
            roleId: memberRole.id,
            departmentId: dept1.id,
            roleTitle: "Frontend Engineer",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib3Uid,
            roleId: memberRole.id,
            departmentId: dept1.id,
            roleTitle: "QA Engineer",
            membershipStatus: "active",
        });

        console.log("  Fixture established: 1 Manager, 2 Co-Leads in Dept Alpha, 3 Contributors, 1 Empty Dept Beta.\n");

        // --- 2. Awards & Shared Competition Ranking Tests (1st, 1st, 3rd) ---
        console.log("--- 2. Test 1: Awards & Shared Competition Ranking for Equal Scores ---");
        // Give Contrib 1: 30 Orbits (15 + 15)
        // Give Contrib 2: 30 Orbits (30) -> TIE for 1st place!
        // Give Contrib 3: 15 Orbits -> Must be 3rd place!
        await WorkspaceRecognitionService.awardOrbits(workspaceId, clubOwnerId, {
            recipientUserId: contrib1Uid,
            categorySlugOrId: "teamwork",
            amount: 15,
            reason: "Outstanding teamwork helping peers resolve issues.",
        });
        await WorkspaceRecognitionService.awardOrbits(workspaceId, clubOwnerId, {
            recipientUserId: contrib1Uid,
            categorySlugOrId: "reliability",
            amount: 15,
            reason: "Consistently delivering high reliability.",
        });
        await WorkspaceRecognitionService.awardOrbits(workspaceId, clubOwnerId, {
            recipientUserId: contrib2Uid,
            categorySlugOrId: "leadership",
            amount: 30,
            reason: "Outstanding initiative and quality deliverables.",
        });
        await WorkspaceRecognitionService.awardOrbits(workspaceId, clubOwnerId, {
            recipientUserId: contrib3Uid,
            categorySlugOrId: "creativity",
            amount: 15,
            reason: "Creative problem solving on core architecture.",
        });

        // Also give Lead Alpha personal Orbits
        await WorkspaceRecognitionService.awardOrbits(workspaceId, clubOwnerId, {
            recipientUserId: leadAlphaUid,
            categorySlugOrId: "leadership",
            amount: 25,
            reason: "Strong department leadership and mentorship.",
        });

        // Fetch Leaderboards
        const lbRes = await WorkspaceRecognitionService.getThreeLeaderboards(workspaceId, contrib1Uid, {
            period: "this_month",
        });

        assert(lbRes.contributors.length >= 3, "At least 3 contributors in contributor leaderboard");

        const c1Entry = lbRes.contributors.find((c: any) => c.userId === contrib1Uid);
        const c2Entry = lbRes.contributors.find((c: any) => c.userId === contrib2Uid);
        const c3Entry = lbRes.contributors.find((c: any) => c.userId === contrib3Uid);

        assert(c1Entry?.orbitsEarned === 30, "Contrib 1 has 30 Orbits");
        assert(c2Entry?.orbitsEarned === 30, "Contrib 2 has 30 Orbits");
        assert(c3Entry?.orbitsEarned === 15, "Contrib 3 has 15 Orbits");

        // Verify shared competition ranking (1st, 1st, 3rd)
        assert(c1Entry?.rank === 1, "Contrib 1 tied for Rank #1");
        assert(c2Entry?.rank === 1, "Contrib 2 tied for Rank #1");
        assert(c3Entry?.rank === 3, "Contrib 3 has Rank #3 (competition rank 1, 1, 3)");

        // Category breakdown verification
        assert(Boolean(c1Entry?.categoryBreakdown["teamwork"]), "Contrib 1 category breakdown includes teamwork");
        assert(Boolean(c1Entry?.categoryBreakdown["reliability"]), "Contrib 1 category breakdown includes reliability");

        // --- 3. Test 2: Manager & Lead Exclusion from Contributor Board ---
        console.log("\n--- 3. Test 2: Manager & Structural Lead Exclusion from Contributor Board ---");
        const hasManagerInContrib = lbRes.contributors.some((c: any) => c.userId === managerUid || c.userId === clubOwnerId);
        const hasLeadAlphaInContrib = lbRes.contributors.some((c: any) => c.userId === leadAlphaUid);
        const hasCoLeadInContrib = lbRes.contributors.some((c: any) => c.userId === coLeadAlphaUid);

        assert(!hasManagerInContrib, "Club Manager and Workspace Manager are EXCLUDED from Contributor Board");
        assert(!hasLeadAlphaInContrib, "Lead Alpha is EXCLUDED from Contributor Board");
        assert(!hasCoLeadInContrib, "Co-Lead Alpha is EXCLUDED from Contributor Board");

        // --- 4. Test 3: Department Lead Leaderboard & Co-leads ---
        console.log("\n--- 4. Test 3: Department Lead Leaderboard & Co-lead Linkage ---");
        const leadAlphaEntry = lbRes.leads.find((l: any) => l.userId === leadAlphaUid);
        const coLeadAlphaEntry = lbRes.leads.find((l: any) => l.userId === coLeadAlphaUid);

        assert(Boolean(leadAlphaEntry), "Lead Alpha present on Department Lead Leaderboard");
        assert(Boolean(coLeadAlphaEntry), "Co-Lead Alpha present on Department Lead Leaderboard");
        assert(leadAlphaEntry?.leadPersonalOrbits === 25, "Lead Alpha personal Orbits displayed separately (25)");
        assert(coLeadAlphaEntry?.isCoLead === true, "Co-Lead Alpha flagged as isCoLead = true");
        assert(leadAlphaEntry?.departmentId === dept1.id, "Lead Alpha linked to Dept Alpha");
        assert(coLeadAlphaEntry?.departmentId === dept1.id, "Co-Lead Alpha linked to Dept Alpha");

        // Verify coLeads array lists the shared co-lead
        const coLeadsListed = coLeadAlphaEntry?.coLeads?.some((cl: any) => cl.userId === leadAlphaUid);
        assert(Boolean(coLeadsListed), "Co-Lead lists shared lead partner correctly");

        // --- 5. Test 4: Department Tasks & DPI Calculation (v1.0 Formula) ---
        console.log("\n--- 5. Test 4: Department Tasks & DPI Calculation ---");
        // Create 2 tasks for Dept Alpha: 1 completed on-time, 1 pending
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const task1Res = await query(
            `INSERT INTO public.workspace_tasks (workspace_id, department_id, creator_id, title, status, due_date, completed_at)
             VALUES ($1, $2, $3, 'Task 1 On Time', 'completed', $4, $5) RETURNING id;`,
            [workspaceId, dept1.id, managerUid, tomorrow.toISOString(), now.toISOString()]
        );
        createdTaskIds.push(task1Res.rows[0].id);

        const task2Res = await query(
            `INSERT INTO public.workspace_tasks (workspace_id, department_id, creator_id, title, status, due_date)
             VALUES ($1, $2, $3, 'Task 2 Pending', 'in_progress', $4) RETURNING id;`,
            [workspaceId, dept1.id, managerUid, tomorrow.toISOString()]
        );
        createdTaskIds.push(task2Res.rows[0].id);

        // Also create a cancelled task (MUST be excluded by score safeguards)
        const task3Res = await query(
            `INSERT INTO public.workspace_tasks (workspace_id, department_id, creator_id, title, status, due_date)
             VALUES ($1, $2, $3, 'Task 3 Cancelled', 'cancelled', $4) RETURNING id;`,
            [workspaceId, dept1.id, managerUid, tomorrow.toISOString()]
        );
        createdTaskIds.push(task3Res.rows[0].id);

        // Invalidate cache and fetch fresh leaderboards
        const lbResWithTasks = await WorkspaceRepository.getThreeLeaderboards(workspaceId, {
            period: "this_month",
        });

        const dept1Entry = lbResWithTasks.departments.find((d: any) => d.departmentId === dept1.id);
        assert(Boolean(dept1Entry), "Dept Alpha found in Department Leaderboard");
        assert(dept1Entry?.hasSufficientData === true, "Dept Alpha has sufficient data (evaluated tasks >= 1)");
        assert(dept1Entry?.metrics.tasksDue === 2, "Cancelled task excluded (evaluated tasks = 2)");
        assert(dept1Entry?.metrics.tasksApproved === 1, "1 task completed/approved");
        assert(dept1Entry?.metrics.tasksOnTime === 1, "1 task on-time");
        assert(dept1Entry?.approvedTaskDeliveryRate === 50, "Approved task rate is 50% (1/2)");
        assert(dept1Entry?.onTimeDeliveryRate === 100, "On-time delivery rate is 100% (1/1 approved)");
        assert(typeof dept1Entry?.departmentPerformanceIndex === "number", "DPI score is a valid calculated number");
        assert(dept1Entry!.departmentPerformanceIndex! > 0, "DPI score is positive");
        assert(dept1Entry?.formulaVersion === "v1.0", "Formula version is v1.0");

        // --- 6. Test 5: Insufficient Data Handling for Empty/Inactive Department ---
        console.log("\n--- 6. Test 5: Insufficient Data Safeguards for Empty Dept Beta ---");
        const dept2Entry = lbResWithTasks.departments.find((d: any) => d.departmentId === dept2.id);
        assert(Boolean(dept2Entry), "Dept Beta found in Department Leaderboard");
        assert(dept2Entry?.hasSufficientData === false, "Dept Beta hasSufficientData = false (0 tasks evaluated)");
        assert(dept2Entry?.departmentPerformanceIndex === null, "Dept Beta DPI is null (not penalized as 0-scoring)");
        assert(dept2Entry?.rank === 0, "Dept Beta is unranked (rank: 0) to avoid humiliating empty department");
        assert(Boolean(dept2Entry?.insufficientDataReason), "Dept Beta has clear insufficientDataReason");

        // --- 7. Test 6: Reversals Excluded from Period Leaderboard ---
        console.log("\n--- 7. Test 6: Compensating Reversals Excluded from Net Orbits ---");
        // Give Contrib 3 an award of 20 Orbits, then reverse it
        const awardToReverse = await WorkspaceRecognitionService.awardOrbits(workspaceId, clubOwnerId, {
            recipientUserId: contrib3Uid,
            categorySlugOrId: "impact",
            amount: 20,
            reason: "Temporary award to be reversed in test.",
        });

        await WorkspaceRecognitionService.reverseAward(workspaceId, clubOwnerId, awardToReverse.id, {
            reversalReason: "Reversing test award as intended.",
        });

        const lbAfterReversal = await WorkspaceRepository.getThreeLeaderboards(workspaceId, {
            period: "this_month",
        });

        const c3AfterRev = lbAfterReversal.contributors.find((c: any) => c.userId === contrib3Uid);
        assert(c3AfterRev?.orbitsEarned === 15, "Reversed 20-point award did NOT inflate net Orbits (remains 15)");

        // --- 8. Test 7: Current Member Position Resolution ---
        console.log("\n--- 8. Test 7: Current Member Position Resolution ---");
        const lbMemberContext = await WorkspaceRepository.getThreeLeaderboards(workspaceId, {
            period: "this_month",
            currentUserId: contrib1Uid,
        });
        assert(lbMemberContext.currentMemberPosition?.type === "contributor", "Contrib 1 identified as 'contributor'");
        assert(lbMemberContext.currentMemberPosition?.rank === 1, "Contrib 1 position rank matches leaderboard (#1)");

        const lbManagerContext = await WorkspaceRepository.getThreeLeaderboards(workspaceId, {
            period: "this_month",
            currentUserId: managerUid,
        });
        assert(lbManagerContext.currentMemberPosition?.type === "excluded_manager", "Manager identified as 'excluded_manager'");

    } catch (err: any) {
        console.error("FATAL ERROR during Phase 05 Leaderboards Test execution:", err);
        failed++;
    } finally {
        console.log("\n--- 9. Ephemeral Fixture Cleanup ---");
        try {
            if (createdUserIds.length > 0) {
                await query(`DELETE FROM public.workspace_recognition_notes WHERE author_id = ANY($1::uuid[]);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_recognition_ledger WHERE recipient_id = ANY($1::uuid[]) OR issuer_id = ANY($1::uuid[]);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_notifications WHERE recipient_id = ANY($1::uuid[]) OR actor_id = ANY($1::uuid[]);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_members WHERE user_id = ANY($1::uuid[]);`, [createdUserIds]);
            }
            if (createdTaskIds.length > 0) {
                await query(`DELETE FROM public.workspace_tasks WHERE id = ANY($1::uuid[]);`, [createdTaskIds]);
            }
            if (createdDeptIds.length > 0) {
                await query(`DELETE FROM public.workspace_departments WHERE id = ANY($1::uuid[]);`, [createdDeptIds]);
            }
            if (createdUserIds.length > 0) {
                await query(`DELETE FROM public.users WHERE id = ANY($1::uuid[]);`, [createdUserIds]);
            }
            console.log(`  Cleaned up ${createdUserIds.length} ephemeral test users, ${createdDeptIds.length} depts, ${createdTaskIds.length} tasks.`);
        } catch (cleanupErr: any) {
            console.warn("  Cleanup warning:", cleanupErr.message);
        }
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 05 THREE LEADERBOARDS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================================");

    if (failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runPhase05Tests().catch((e) => {
    console.error(e);
    process.exit(1);
});
