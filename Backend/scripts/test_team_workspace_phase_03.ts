// Backend/scripts/test_team_workspace_phase_03.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase03Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 03 OVERVIEW, DEPTS & MEMBERS ACCEPTANCE SUITE");
    console.log("===============================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(desc: string, condition: boolean) {
        if (condition) {
            console.log(`  ✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${desc}`);
            failed++;
        }
    }

    try {
        // 1. SETUP
        const clubsQuery = await query(`
            SELECT id, auth_user_id, name, slug 
            FROM public.verified_clubs 
            ORDER BY created_at ASC 
            LIMIT 1;
        `);

        if (clubsQuery.rows.length === 0) {
            throw new Error("No verified club available in database for testing.");
        }

        const club = clubsQuery.rows[0];
        console.log(`Target Club: "${club.name}" (Club ID: ${club.id}, Owner User ID: ${club.auth_user_id})\n`);

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(
            club.id,
            club.auth_user_id
        );
        const workspaceId = workspace.id;

        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const deptLeadRole = roles.find((r) => r.slug === "dept_lead")!;
        const memberRole = roles.find((r) => r.slug === "member")!;

        // Generate isolated test personas
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p3_${roleName}_${randKey}@orbix.test`,
                    `u3_${roleName}_${randKey}`.slice(0, 20),
                    `P3_${roleName}`,
                    "User",
                ]
            );
            return uRes.rows[0];
        };

        const leadUser = await makeUser("lead");
        const member1User = await makeUser("mem1");
        const member2User = await makeUser("mem2");

        // Create 2 test departments
        const dept1 = await WorkspaceDepartmentService.createDepartment(workspaceId, club.auth_user_id, {
            name: `P3 Dept Alpha ${randKey}`,
            description: "Phase 3 test department Alpha",
            color: "#2563eb",
            icon: "Code",
            leadUserId: leadUser.id,
        });

        const dept2 = await WorkspaceDepartmentService.createDepartment(workspaceId, club.auth_user_id, {
            name: `P3 Dept Beta ${randKey}`,
            description: "Phase 3 test department Beta",
            color: "#dc2626",
            icon: "Palette",
        });

        // Add lead to workspace and dept1
        await query(
            `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, role_title)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = $3;`,
            [workspaceId, leadUser.id, deptLeadRole.id, "Department Lead"]
        );

        // Add member1 to workspace and dept1
        const mem1Res = await query(
            `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, role_title)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = $3
             RETURNING id;`,
            [workspaceId, member1User.id, memberRole.id, "Member"]
        );
        const member1Id = mem1Res.rows[0].id;

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept1.id,
            member1Id,
            "member",
            "Junior Dev"
        );

        // Add member2 to workspace and dept2 only
        const mem2Res = await query(
            `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, role_title)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = $3
             RETURNING id;`,
            [workspaceId, member2User.id, memberRole.id, "Member"]
        );
        const member2Id = mem2Res.rows[0].id;

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept2.id,
            member2Id,
            "member",
            "Designer"
        );

        // Create tasks in dept1 and dept2
        await query(
            `INSERT INTO public.workspace_tasks (workspace_id, department_id, title, status, priority, creator_id)
             VALUES ($1, $2, $3, 'in_progress', 'medium', $4);`,
            [workspaceId, dept1.id, `Task in Dept 1 ${randKey}`, club.auth_user_id]
        );
        await query(
            `INSERT INTO public.workspace_tasks (workspace_id, department_id, title, status, priority, creator_id)
             VALUES ($1, $2, $3, 'in_progress', 'high', $4);`,
            [workspaceId, dept2.id, `Task in Dept 2 ${randKey}`, club.auth_user_id]
        );

        // ---------------------------------------------------------------------
        // PART A: WORKSPACE OVERVIEW SCOPING & NON-LEAKAGE
        // ---------------------------------------------------------------------
        console.log("PART A: Workspace Overview Data Scoping & Non-Leakage");

        // 1. Manager (Owner) Overview: Sees global statistics
        const globalMetrics = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, club.auth_user_id);
        assert("Global overview contains all active departments", globalMetrics.totalDepartments >= 2);
        assert("Global overview contains all active members", globalMetrics.totalMembers >= 3);

        // 2. Department Lead Overview: Sees only accessible department statistics
        const leadMetrics = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, leadUser.id);
        assert("Lead overview scopes totalDepartments to 1 (Dept 1)", leadMetrics.totalDepartments === 1);
        assert("Lead overview does NOT count Dept 2 in totalDepartments", leadMetrics.totalDepartments < globalMetrics.totalDepartments);
        assert("Lead overview does NOT leak Dept 2 members in totalMembers", leadMetrics.totalMembers >= 1 && leadMetrics.totalMembers < globalMetrics.totalMembers);

        // ---------------------------------------------------------------------
        // PART B: DEPARTMENT MANAGEMENT OPERATIONS
        // ---------------------------------------------------------------------
        console.log("\nPART B: Department Operations (Edit, Reorder, Scoped Roles)");

        // 1. Edit department details
        const updatedDept1 = await WorkspaceDepartmentService.updateDepartment(
            workspaceId,
            leadUser.id,
            dept1.id,
            {
                name: `Renamed Alpha ${randKey}`,
                description: "Updated description by authorized lead",
                color: "#10b981",
            }
        );
        assert("Lead can update their assigned department name", updatedDept1.name === `Renamed Alpha ${randKey}`);
        assert("Lead can update their assigned department color", updatedDept1.color === "#10b981");

        // 2. Lead CANNOT edit another department (Dept 2)
        let leadEditDept2Failed = false;
        try {
            await WorkspaceDepartmentService.updateDepartment(
                workspaceId,
                leadUser.id,
                dept2.id,
                { name: "Unauthorized Rename" }
            );
        } catch (err: any) {
            leadEditDept2Failed = true;
        }
        assert("Lead cannot edit details of another department", leadEditDept2Failed);

        // 3. Reorder departments
        const deptsBefore = await WorkspaceDepartmentService.listDepartments(workspaceId);
        const activeDepts = deptsBefore.filter((d) => d.status === "active");
        const reversedIds = activeDepts.map((d) => d.id).reverse();

        const reorderSuccess = await WorkspaceDepartmentService.reorderDepartments(
            workspaceId,
            club.auth_user_id,
            reversedIds
        );
        assert("Manager can reorder departments", reorderSuccess === true);

        const deptsAfter = await WorkspaceDepartmentService.listDepartments(workspaceId);
        const activeAfter = deptsAfter.filter((d) => d.status === "active");
        assert("First department after reorder matches reversed list", activeAfter[0].id === reversedIds[0]);

        // 4. Assign Scoped Role in Department
        const roleUpdated = await WorkspaceDepartmentService.updateDepartmentMemberRole(
            workspaceId,
            leadUser.id,
            dept1.id,
            member1Id,
            {
                departmentRole: "co_lead",
                roleTitle: "Staff Software Engineer",
            }
        );
        assert("Lead can update department member scoped role & title", roleUpdated === true);

        const dept1Details = await WorkspaceDepartmentService.getDepartmentDetails(workspaceId, dept1.id);
        const m1InDept = dept1Details.members.find((m) => m.memberId === member1Id);
        assert("Member has updated departmentRole = 'co_lead'", m1InDept?.departmentRole === "co_lead");
        assert("Member has custom roleTitle = 'Staff Software Engineer'", m1InDept?.roleTitle === "Staff Software Engineer");

        // ---------------------------------------------------------------------
        // PART C & D: MEMBER DIRECTORY & PRIVACY
        // ---------------------------------------------------------------------
        console.log("\nPART C & D: Member Directory Operations & Privacy Protection");

        // 1. Hierarchy Check: Member cannot remove Lead
        let memberRemoveLeadFailed = false;
        try {
            await WorkspaceMemberService.removeMember(workspaceId, member1User.id, leadUser.id);
        } catch (err: any) {
            memberRemoveLeadFailed = true;
        }
        assert("Member cannot remove Department Lead (hierarchy restriction)", memberRemoveLeadFailed);

        // 2. Owner Protection: Manager cannot remove Owner
        let removeOwnerFailed = false;
        try {
            await WorkspaceMemberService.removeMember(workspaceId, leadUser.id, club.auth_user_id);
        } catch (err: any) {
            removeOwnerFailed = true;
        }
        assert("Cannot remove the workspace owner", removeOwnerFailed);

        // 3. Authorized Member Removal
        const removedSuccess = await WorkspaceMemberService.removeMember(
            workspaceId,
            club.auth_user_id,
            member2User.id
        );
        assert("Manager can remove member from workspace", removedSuccess === true);

        const checkMember2 = await WorkspaceRepository.findMember(workspaceId, member2User.id);
        assert("Removed member no longer exists in workspace_members", checkMember2 === null);

        const checkDept2Members = await query(
            `SELECT * FROM public.workspace_department_members WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, member2User.id]
        );
        assert("Removed member cleaned up from workspace_department_members", checkDept2Members.rows.length === 0);

        // Cleanup test artifacts
        await query(`DELETE FROM public.workspace_tasks WHERE workspace_id = $1 AND title LIKE '%${randKey}%';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_department_members WHERE workspace_id = $1 AND department_id IN ($2, $3);`, [workspaceId, dept1.id, dept2.id]);
        await query(`DELETE FROM public.workspace_departments WHERE id IN ($1, $2);`, [dept1.id, dept2.id]);
        await query(`DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id IN ($2, $3, $4);`, [workspaceId, leadUser.id, member1User.id, member2User.id]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUser.id, member1User.id, member2User.id]);

        console.log("\n===============================================================================");
        console.log(`PHASE 03 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log("===============================================================================\n");

        if (failed > 0) {
            process.exit(1);
        }
    } catch (err: any) {
        console.error("Test execution failed with unhandled error:", err);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

runPhase03Tests();
