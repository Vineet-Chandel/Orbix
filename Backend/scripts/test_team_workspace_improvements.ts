// Backend/scripts/test_team_workspace_improvements.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceTemplateService } from "../src/services/workspace/workspaceTemplateService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";
import { createRedisClient } from "../src/redis/client.js";
import { getBullMQConnectionOptions } from "../src/queues/workspaceQueues.js";

let testsPassed = 0;
let testsFailed = 0;

function assert(description: string, condition: boolean, extraInfo?: any) {
    if (condition) {
        console.log(`  ✅ [PASS] ${description}`);
        testsPassed++;
    } else {
        console.error(`  ❌ [FAIL] ${description}`, extraInfo ? extraInfo : "");
        testsFailed++;
    }
}

async function runImprovementsTestSuite() {
    console.log("================================================================================");
    console.log("ORBIX TEAM WORKSPACE — PRODUCTION ENHANCEMENTS & ACCOUNTABILITY TEST SUITE");
    console.log("REDIS ISOLATION, TEMPLATES, WORKLOAD, TRANSFERS & SECURE INVITATIONS");
    console.log("================================================================================\n");

    try {
        const runId = Date.now().toString(36);

        // Fetch or identify test club
        const clubRes = await query(
            `SELECT id, name, auth_user_id FROM public.verified_clubs WHERE auth_user_id IS NOT NULL LIMIT 1;`
        );
        if (!clubRes.rows.length) {
            throw new Error("No verified club available for testing.");
        }
        const club = clubRes.rows[0];

        // Provision or load workspace
        const wsInit = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, club.auth_user_id);
        const wsId = wsInit.workspace.id;
        const workspace = wsInit.workspace;

        // Create 2 test users
        const u1Res = await query(
            `INSERT INTO public.users (email, username, password, firstname, lastname)
             VALUES ($1, $2, 'hash123', 'Alice', 'Engineer')
             RETURNING id, email, username;`,
            [`alice.imp.${runId}@orbix.club`, `alice_imp_${runId}`]
        );
        const user1 = u1Res.rows[0];

        const u2Res = await query(
            `INSERT INTO public.users (email, username, password, firstname, lastname)
             VALUES ($1, $2, 'hash123', 'Bob', 'Robotics')
             RETURNING id, email, username;`,
            [`bob.imp.${runId}@orbix.club`, `bob_imp_${runId}`]
        );
        const user2 = u2Res.rows[0];

        const roles = await WorkspaceRepository.listRoles(wsId);
        const memberRole = roles.find((r) => r.isSystem && r.name === "Member") || roles[roles.length - 1]!;

        // Add user1 and user2 to workspace
        const member1 = await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: user1.id,
            roleId: memberRole.id,
            roleTitle: "Systems Engineer",
        });
        const member2 = await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: user2.id,
            roleId: memberRole.id,
            roleTitle: "Automation Engineer",
        });

        // =====================================================================
        // SECTION A: REDIS THREE DISTINCT RESPONSIBILITIES & ISOLATION
        // =====================================================================
        console.log("\n--- SECTION A: REDIS THREE DISTINCT RESPONSIBILITIES ---");

        // A.1 Dedicated Cache Client
        const cacheClient = createRedisClient(undefined, "cache");
        assert("Cache Redis client initialized with ready status check", cacheClient !== null);
        const cachePing = await cacheClient.ping();
        assert("Cache Redis responds to PING with PONG", cachePing === "PONG");

        // A.2 Persistent BullMQ Connection Options
        const queueOpts = getBullMQConnectionOptions();
        assert("BullMQ queue connection options configured with maxRetriesPerRequest=null", queueOpts.maxRetriesPerRequest === null);
        assert("BullMQ queue options have valid host", Boolean(queueOpts.host));

        // A.3 Rate Limiting & Sliding Window Ephemeral State
        const rateLimitKey = `test_ratelimit:${runId}`;
        const firstRateCheck = await WorkspaceRedisService.checkRateLimit(rateLimitKey, 5, 10);
        assert("Rate limiting allows initial request", firstRateCheck.allowed);
        assert("Rate limiting tracks remaining quota correctly", firstRateCheck.remaining === 4);

        // Exhaust quota
        for (let i = 0; i < 4; i++) {
            await WorkspaceRedisService.checkRateLimit(rateLimitKey, 5, 10);
        }
        const blockedCheck = await WorkspaceRedisService.checkRateLimit(rateLimitKey, 5, 10);
        assert("Rate limiting blocks excessive bursts when limit exceeded", !blockedCheck.allowed);
        assert("Rate limiting remaining quota hits 0", blockedCheck.remaining === 0);

        // =====================================================================
        // SECTION B: 7 WORKSPACE TEMPLATES & CUSTOMIZABLE ROLES
        // =====================================================================
        console.log("\n--- SECTION B: 7 WORKSPACE TEMPLATES & CUSTOMIZABLE ROLES ---");

        const availableTemplates = WorkspaceTemplateService.getAvailableTemplates();
        assert("WorkspaceTemplateService exposes exactly 7 canonical templates", availableTemplates.length === 7);

        const templateIds = availableTemplates.map((t) => t.id);
        assert("Template catalog includes 'technical'", templateIds.includes("technical"));
        assert("Template catalog includes 'coding'", templateIds.includes("coding"));
        assert("Template catalog includes 'design'", templateIds.includes("design"));
        assert("Template catalog includes 'photography'", templateIds.includes("photography"));
        assert("Template catalog includes 'entrepreneurship'", templateIds.includes("entrepreneurship"));
        assert("Template catalog includes 'general'", templateIds.includes("general"));
        assert("Template catalog includes 'custom'", templateIds.includes("custom"));

        // Clean up previously applied template test artifacts for wsId to ensure fresh assertion
        await pool.query(
            `DELETE FROM public.workspace_channels WHERE workspace_id = $1 AND slug IN ('circuits-pcb', 'robotics-builds', 'firmware-code', 'rfcs-architecture', 'parts-requests');`,
            [wsId]
        );
        await pool.query(
            `DELETE FROM public.workspace_departments WHERE workspace_id = $1 AND slug IN ('hardware-embedded', 'robotics-automation', 'tech-projects-rnd', 'lab-safety-logistics');`,
            [wsId]
        );
        await pool.query(
            `DELETE FROM public.workspace_channel_categories WHERE workspace_id = $1 AND name IN ('Engineering & Hardware', 'Procurement & Safety');`,
            [wsId]
        );
        await pool.query(
            `DELETE FROM public.workspace_roles WHERE workspace_id = $1 AND name IN ('Technical Lead', 'Lab Coordinator', 'Hardware Specialist');`,
            [wsId]
        );

        // Apply Technical Club template
        const techResult = await WorkspaceTemplateService.applyTemplate(wsId, club.auth_user_id, "technical");
        assert("Technical Club template applied successfully", techResult.template.id === "technical");
        assert("Template created departments", techResult.departmentsCreated >= 4);
        assert("Template created categories and channels", techResult.channelsCreated >= 4);
        assert("Template created customizable custom roles", techResult.rolesCreated >= 3);

        // Verify template roles are customizable (is_system = false, rank <= 799)
        const updatedRoles = await WorkspaceRepository.listRoles(wsId);
        const techLeadRole = updatedRoles.find((r) => r.name === "Technical Lead");
        assert("Technical Lead custom role created", Boolean(techLeadRole));
        assert("Technical Lead role is customizable (is_system = false)", techLeadRole?.isSystem === false);
        assert("Technical Lead role has rank <= 799", (techLeadRole?.rank || 0) <= 799);

        // Idempotent re-application test
        const reapplyResult = await WorkspaceTemplateService.applyTemplate(wsId, club.auth_user_id, "technical");
        assert("Re-applying template is idempotent (0 new departments)", reapplyResult.departmentsCreated === 0);
        assert("Re-applying template is idempotent (0 new channels)", reapplyResult.channelsCreated === 0);
        assert("Re-applying template is idempotent (0 new roles)", reapplyResult.rolesCreated === 0);

        // =====================================================================
        // SECTION C: WORKLOAD AND TASK ACCOUNTABILITY VIEWS
        // =====================================================================
        console.log("\n--- SECTION C: WORKLOAD AND TASK ACCOUNTABILITY VIEWS ---");

        // Create Seed Departments
        const depts = await WorkspaceRepository.listDepartments(wsId);
        const hardwareDept = depts.find((d) => d.slug === "hardware-embedded") || depts[0]!;
        const roboticsDept = depts.find((d) => d.slug === "robotics-automation") || depts[1]!;

        // Add member1 to hardwareDept
        await WorkspaceRepository.addDepartmentMember(null, {
            workspaceId: wsId,
            departmentId: hardwareDept.id,
            memberId: member1.id,
            userId: user1.id,
            departmentRole: "member",
            roleTitle: "Firmware Developer",
            assignedBy: club.auth_user_id,
        });

        // 1. Create a task awaiting review (submitted)
        const task1 = await WorkspaceTaskService.createTask(wsId, club.auth_user_id, {
            title: `Microcontroller PCB Review ${runId}`,
            departmentId: hardwareDept.id,
            priority: "high",
            assigneeUserIds: [user1.id],
        });
        await WorkspaceTaskService.transitionTaskStatus(wsId, user1.id, task1.id, "in_progress");
        await WorkspaceTaskService.submitTask(wsId, user1.id, task1.id, "Gerber files ready for fabrication.");

        // 2. Create an unassigned task
        const taskUnassigned = await WorkspaceTaskService.createTask(wsId, club.auth_user_id, {
            title: `Order Lab Safety Goggles ${runId}`,
            departmentId: hardwareDept.id,
            priority: "medium",
            assigneeUserIds: [], // explicitly unassigned
        });

        // 3. Create a task nearing deadline (due in 24 hours)
        const dueTomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const taskNearing = await WorkspaceTaskService.createTask(wsId, club.auth_user_id, {
            title: `Submit Design Expo Proposal ${runId}`,
            departmentId: hardwareDept.id,
            priority: "urgent",
            dueDate: dueTomorrow,
            assigneeUserIds: [user1.id],
        });

        // 4. Create an overdue task (due yesterday)
        const dueYesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const taskOverdue = await WorkspaceTaskService.createTask(wsId, club.auth_user_id, {
            title: `Submit Component Requisition ${runId}`,
            departmentId: hardwareDept.id,
            priority: "urgent",
            dueDate: dueYesterday,
            assigneeUserIds: [user1.id],
        });

        // 5. Create a blocked task
        const taskBlocked = await WorkspaceTaskService.createTask(wsId, club.auth_user_id, {
            title: `Motor Driver Calibration ${runId}`,
            departmentId: hardwareDept.id,
            priority: "high",
            assigneeUserIds: [user1.id],
        });
        await WorkspaceTaskService.transitionTaskStatus(wsId, user1.id, taskBlocked.id, "in_progress");
        await WorkspaceTaskService.transitionTaskStatus(wsId, user1.id, taskBlocked.id, "blocked", undefined, "Waiting for oscilloscope");

        // Query Accountability Overview
        const accountability = await WorkspaceTaskService.getAccountabilityOverview(wsId, club.auth_user_id);
        assert("Accountability overview returns summary counters", Boolean(accountability.summary));
        assert("Awaiting review count >= 1", accountability.summary.awaitingReviewCount >= 1);
        assert("Unassigned count >= 1", accountability.summary.unassignedCount >= 1);
        assert("Nearing deadline count >= 1", accountability.summary.nearingDeadlineCount >= 1);
        assert("Overdue count >= 1", accountability.summary.overdueCount >= 1);
        assert("Blocked count >= 1", accountability.summary.blockedCount >= 1);

        assert("Tasks awaiting review array contains submitted task", accountability.tasksAwaitingReview.some((t: any) => t.id === task1.id));
        assert("Tasks unassigned array contains unassigned task", accountability.tasksUnassigned.some((t: any) => t.id === taskUnassigned.id));
        assert("Tasks nearing deadline array contains near-deadline task", accountability.tasksNearingDeadline.some((t: any) => t.id === taskNearing.id));
        assert("Tasks overdue array contains overdue task", accountability.tasksOverdue.some((t: any) => t.id === taskOverdue.id));
        assert("Tasks blocked array contains blocked task", accountability.tasksBlocked.some((t: any) => t.id === taskBlocked.id));

        assert("Department workload breakdown returns entries", accountability.departmentWorkload.length >= 1);
        const hwWorkload = accountability.departmentWorkload.find((d: any) => d.departmentId === hardwareDept.id);
        assert("Hardware department workload tracks active tasks", (hwWorkload?.activeTasksCount || 0) >= 3);
        assert("Hardware department workload tracks member count", (hwWorkload?.memberCount || 0) >= 1);

        assert("Member workload distribution returns entries", accountability.memberWorkload.length >= 1);
        const user1Workload = accountability.memberWorkload.find((m: any) => m.userId === user1.id);
        assert("User 1 active task count tracked accurately", (user1Workload?.activeTasksCount || 0) >= 3);

        // 6. Task Reassignment History Tracking
        const taskReassign = await WorkspaceTaskService.createTask(wsId, club.auth_user_id, {
            title: `Battery Pack Thermal Simulation ${runId}`,
            departmentId: hardwareDept.id,
            priority: "medium",
            assigneeUserIds: [user1.id],
        });

        // Reassign to user2
        await WorkspaceTaskService.setTaskAssignees(wsId, club.auth_user_id, taskReassign.id, [user2.id]);

        const reassignmentHistory = await WorkspaceTaskService.getReassignmentHistory(wsId, club.auth_user_id, taskReassign.id);
        assert("Reassignment history contains both assignments", reassignmentHistory.length === 2);
        assert("First assignee was user1", reassignmentHistory[0]?.userId === user1.id);
        assert("First assignee has unassignedAt timestamp recorded", reassignmentHistory[0]?.unassignedAt !== null);
        assert("First assignee isActive is false", reassignmentHistory[0]?.isActive === false);
        assert("Second assignee is user2", reassignmentHistory[1]?.userId === user2.id);
        assert("Second assignee isActive is true", reassignmentHistory[1]?.isActive === true);
        assert("Reassignment records who assigned the task", reassignmentHistory[1]?.assignedBy === club.auth_user_id);

        // =====================================================================
        // SECTION D: DEPARTMENT TRANSFER HISTORY & TASK PRESERVATION
        // =====================================================================
        console.log("\n--- SECTION D: DEPARTMENT TRANSFER HISTORY & TASK PRESERVATION ---");

        // Transfer user1 from hardwareDept to roboticsDept
        const transferSuccess = await WorkspaceDepartmentService.transferMember(
            wsId,
            club.auth_user_id,
            member1.id,
            hardwareDept.id,
            roboticsDept.id,
            "Transferring to lead ROS autonomous navigation sprint"
        );
        assert("Department transfer execution returned success", transferSuccess === true);

        // Verify user1 is no longer in hardwareDept
        const hwMembersAfter = await WorkspaceRepository.listDepartmentMembers(wsId, hardwareDept.id);
        assert("User 1 removed from source department (Hardware)", !hwMembersAfter.some((m) => m.userId === user1.id));

        // Verify user1 is in roboticsDept
        const roboticsMembersAfter = await WorkspaceRepository.listDepartmentMembers(wsId, roboticsDept.id);
        assert("User 1 added to destination department (Robotics)", roboticsMembersAfter.some((m) => m.userId === user1.id));

        // Verify historical tasks in Hardware department are NOT deleted or reassigned
        const taskOverdueRefetch = await WorkspaceTaskService.getTask(wsId, club.auth_user_id, taskOverdue.id);
        assert("Historical task in former department is preserved", taskOverdueRefetch.id === taskOverdue.id);
        assert("Historical task departmentId remains former department", taskOverdueRefetch.departmentId === hardwareDept.id);
        assert("Historical task assignee remains User 1", taskOverdueRefetch.assignees.some((a) => a.userId === user1.id));

        // Verify transfer audit ledger in workspace_department_transfers
        const transferLedger = await WorkspaceDepartmentService.getDepartmentTransfers(wsId, club.auth_user_id, {
            userId: user1.id,
        });
        assert("Department transfer ledger recorded the transfer", transferLedger.length >= 1);
        const latestTransfer = transferLedger[0]!;
        assert("Transfer ledger records fromDepartmentId", latestTransfer.fromDepartmentId === hardwareDept.id);
        assert("Transfer ledger records toDepartmentId", latestTransfer.toDepartmentId === roboticsDept.id);
        assert("Transfer ledger records transferredBy actor", latestTransfer.transferredBy === club.auth_user_id);
        assert("Transfer ledger preserves reason", latestTransfer.reason === "Transferring to lead ROS autonomous navigation sprint");
        assert("Transfer ledger populates fromDepartment name", latestTransfer.fromDepartment?.name === hardwareDept.name);
        assert("Transfer ledger populates toDepartment name", latestTransfer.toDepartment?.name === roboticsDept.name);

        // =====================================================================
        // SECTION E: SECURE WORKSPACE INVITATION EXPERIENCE
        // =====================================================================
        console.log("\n--- SECTION E: SECURE WORKSPACE INVITATION EXPERIENCE ---");

        // 1. Create invitation
        const inviteEmail = `invitee.${runId}@orbix.club`;
        const { invitation, rawToken } = await WorkspaceMemberService.createInvitation(
            wsId,
            club.auth_user_id,
            {
                email: inviteEmail,
                roleId: memberRole.id,
                departmentId: roboticsDept.id,
                invitationMessage: "Welcome to the Robotics Chapter!",
            }
        );
        assert("Invitation created with valid ID", Boolean(invitation.id));
        assert("Raw token is 64-character hex string", rawToken.length === 64);

        // 2. Preview & Verification endpoint without accepting
        const verifyResult = await WorkspaceMemberService.verifyInvitation(rawToken);
        assert("Invitation verification reports isValid=true", verifyResult.isValid === true);
        assert("Verification preview reveals workspaceName", verifyResult.invitation?.workspaceName === workspace.name);
        assert("Verification preview reveals clubName", verifyResult.invitation?.clubName === club.name);
        assert("Verification preview reveals roleName", verifyResult.invitation?.roleName === memberRole.name);
        assert("Verification preview reveals departmentName", verifyResult.invitation?.departmentName === roboticsDept.name);
        assert("Verification preview reveals inviterName", Boolean(verifyResult.invitation?.inviterName));
        assert("Verification preview reveals invitationMessage", verifyResult.invitation?.invitationMessage === "Welcome to the Robotics Chapter!");
        assert("Verification preview includes future expiresAt timestamp", new Date(verifyResult.invitation?.expiresAt || 0) > new Date());

        // 3. Inviter Permission Revalidation Protection:
        // Create an invitation from a member with invite permissions, then demote/suspend the inviter
        const subAdminRes = await query(
            `INSERT INTO public.users (email, username, password, firstname, lastname)
             VALUES ($1, $2, 'hash123', 'SubAdmin', 'Inviter')
             RETURNING id, email, username;`,
            [`subadmin.${runId}@orbix.club`, `subadmin_${runId}`]
        );
        const subAdminUser = subAdminRes.rows[0];

        // Give subAdmin a role with members:invite
        const invitePermRole = await WorkspaceMemberService.createCustomRole(wsId, club.auth_user_id, {
            name: `Recruiter ${runId}`,
            rank: 600,
            permissions: ["members:invite"],
        });
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: subAdminUser.id,
            roleId: invitePermRole.id,
            roleTitle: "Campus Recruiter",
        });

        // SubAdmin creates an invitation
        const subInvite = await WorkspaceMemberService.createInvitation(
            wsId,
            subAdminUser.id,
            {
                email: `candidate.${runId}@orbix.club`,
                roleId: memberRole.id,
            }
        );

        // Now suspend SubAdmin!
        await WorkspaceService.setMemberSuspension(wsId, subAdminUser.id, club.auth_user_id, true, "Security investigation");

        // Now attempt to accept SubAdmin's invitation - MUST BE REJECTED!
        const candidateRes = await query(
            `INSERT INTO public.users (email, username, password, firstname, lastname)
             VALUES ($1, $2, 'hash123', 'Candidate', 'Applicant')
             RETURNING id, email, username;`,
            [`candidate.${runId}@orbix.club`, `candidate_${runId}`]
        );
        const candidateUser = candidateRes.rows[0];

        let acceptanceBlocked = false;
        try {
            await WorkspaceMemberService.acceptInvitation(subInvite.rawToken, candidateUser.id);
            acceptanceBlocked = false;
        } catch (err: any) {
            acceptanceBlocked = err.message.includes("inviting member's permissions have changed");
        }
        assert("Invitation acceptance rejected when inviter permissions are revoked/suspended", acceptanceBlocked);

        // Also verification preview detects inviter invalidation
        const invalidVerify = await WorkspaceMemberService.verifyInvitation(subInvite.rawToken);
        assert("Verification preview reports inviter is no longer authorized", invalidVerify.isValid === false);

        // 4. Clean single-use acceptance of valid invitation
        const validAcceptUserRes = await query(
            `INSERT INTO public.users (email, username, password, firstname, lastname)
             VALUES ($1, $2, 'hash123', 'Valid', 'Joiner')
             RETURNING id, email, username;`,
            [`joiner.${runId}@orbix.club`, `joiner_${runId}`]
        );
        const validJoiner = validAcceptUserRes.rows[0];

        const acceptResult = await WorkspaceMemberService.acceptInvitation(rawToken, validJoiner.id);
        assert("Valid invitation accepted successfully", Boolean(acceptResult.member.id));
        assert("Accepted member assigned into target department (Robotics)", acceptResult.member.departmentId === roboticsDept.id);

        // Single-use enforcement: re-accepting same token must fail
        let replayBlocked = false;
        try {
            await WorkspaceMemberService.acceptInvitation(rawToken, validJoiner.id);
            replayBlocked = false;
        } catch (err: any) {
            replayBlocked = err.message.includes("already been accepted");
        }
        assert("Replay of accepted token is strictly blocked (single-use enforcement)", replayBlocked);

        console.log("\n================================================================================");
        console.log(`PRODUCTION ENHANCEMENTS TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
        console.log("================================================================================\n");

        if (testsFailed > 0) {
            process.exit(1);
        }
    } catch (err: any) {
        console.error("Test execution failed with fatal error:", err);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

runImprovementsTestSuite();
