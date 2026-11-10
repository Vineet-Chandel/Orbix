// Backend/scripts/test_team_workspace_phase_05.ts
import crypto from "crypto";
import { query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceTaskService, VALID_STATUS_TRANSITIONS } from "../src/services/workspace/workspaceTaskService.js";
import redis from "../src/redis/client.js";

async function runPhase05Tests() {
    console.log("=================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 05 ACCEPTANCE & VERIFICATION SUITE");
    console.log("TEAM TASK MANAGEMENT SYSTEM & WORKFLOW ENGINE");
    console.log("=================================================================\n");

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
        // ---------------------------------------------------------------------
        // SETUP: Retrieve Test Club & Ensure Workspace Exists
        // ---------------------------------------------------------------------
        console.log("SETUP: Identifying Club and Provisioning Root Workspace...");
        const clubRes = await query(`
            SELECT id, auth_user_id, name, slug 
            FROM public.verified_clubs 
            ORDER BY created_at ASC 
            LIMIT 1;
        `);

        if (clubRes.rows.length === 0) {
            throw new Error("No verified club found for test execution.");
        }

        const club = clubRes.rows[0];
        console.log(`  Using Club: "${club.name}" (ID: ${club.id}) Owner: ${club.auth_user_id}\n`);

        const { workspace, member: ownerMember } = await WorkspaceService.getOrCreateWorkspaceForClub(
            club.id,
            club.auth_user_id
        );
        const workspaceId = workspace.id;

        // Provision 3 test users: Lead, Member A, Member B
        const rnd = crypto.randomBytes(3).toString("hex");
        async function createTestUser(roleSuffix: string) {
            const uid = crypto.randomUUID();
            const email = `test.task.${roleSuffix}.${rnd}@orbix.dev`;
            const username = `task_${roleSuffix}_${rnd}`;
            const uRes = await query(
                `INSERT INTO public.users (id, email, username, firstname, lastname, password, account_type, is_public, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, 'dummy_hash', 'personal', true, NOW(), NOW())
                 RETURNING id, email, username, firstname, lastname;`,
                [uid, email, username, `Task${roleSuffix}`, "Tester"]
            );
            return uRes.rows[0];
        }

        const leadUser = await createTestUser("lead");
        const memberA = await createTestUser("mem_a");
        const memberB = await createTestUser("mem_b");

        // Fetch roles
        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const deptLeadRole = roles.find((r) => r.slug === "dept_lead") || roles[0];
        const regularMemberRole = roles.find((r) => r.slug === "member") || roles[0];

        // Create a test department
        const testDept = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            club.auth_user_id,
            {
                name: `Eng Dept ${rnd}`,
                description: "Engineering department for task management tests",
                color: "#2563eb",
                icon: "Code",
                leadUserId: leadUser.id,
            }
        );

        // Add lead and memberA to workspace and department
        const leadMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: leadUser.id,
            roleId: deptLeadRole.id,
            roleTitle: "Engineering Lead",
            departmentId: testDept.id,
        });

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            testDept.id,
            leadMember.id,
            "lead",
            "Lead Architect"
        );

        const memA = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: memberA.id,
            roleId: regularMemberRole.id,
            roleTitle: "Backend Developer",
            departmentId: testDept.id,
        });

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            testDept.id,
            memA.id,
            "member",
            "Core Engineer"
        );

        // Add memberB to workspace WITHOUT department
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: memberB.id,
            roleId: regularMemberRole.id,
            roleTitle: "General Member",
        });

        console.log("SETUP COMPLETE: Workspace, test department, and members ready.\n");

        // ---------------------------------------------------------------------
        // TEST SUITE 1: Task Creation with Rich Attributes
        // ---------------------------------------------------------------------
        console.log("TEST SUITE 1: Task Creation with Rich Attributes");

        const sampleChecklist = [
            { id: "c1", text: "Design database migration", isCompleted: true },
            { id: "c2", text: "Implement repository layer", isCompleted: false },
            { id: "c3", text: "Write acceptance test suite", isCompleted: false },
        ];
        const sampleLinks = [
            { title: "Architecture RFC", url: "https://orbix.dev/rfc/task-system" },
        ];

        const task1 = await WorkspaceTaskService.createTask(workspaceId, club.auth_user_id, {
            title: "Implement Task Engine Core",
            description: "Build robust multi-assignee task workflows with state machines.",
            departmentId: testDept.id,
            priority: "urgent",
            startDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
            checklist: sampleChecklist,
            referenceLinks: sampleLinks,
            isRestricted: false,
            assigneeUserIds: [memberA.id],
        });

        assert("Task created with valid ID", Boolean(task1.id));
        assert("Task title matches payload", task1.title === "Implement Task Engine Core");
        assert("Task priority is urgent", task1.priority === "urgent");
        assert("Task initial status is assigned (since assignees provided)", task1.status === "assigned");
        assert("Task checklist contains 3 items", task1.checklist?.length === 3);
        assert("Task checklist first item is completed", task1.checklist?.[0]?.isCompleted === true);
        assert("Task reference link matches", task1.referenceLinks?.[0]?.title === "Architecture RFC");
        assert("Task version starts at 1", task1.version === 1);
        assert("Task creator matches club owner", task1.creatorId === club.auth_user_id);
        assert("Task assignees count is 1", task1.currentAssignees?.length === 1);
        assert("Task assignee matches memberA", task1.currentAssignees?.[0]?.userId === memberA.id);

        // ---------------------------------------------------------------------
        // TEST SUITE 2: Multi-Member Assignment & Reassignment History
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 2: Multi-Member Assignment & Reassignment History");

        // Lead adds memberB and keeps memberA
        const reassignedTask = await WorkspaceTaskService.setTaskAssignees(
            workspaceId,
            leadUser.id,
            task1.id,
            [memberA.id, memberB.id]
        );

        assert("Current assignees count is 2", reassignedTask.currentAssignees?.length === 2);

        // Unassign memberA, keep memberB
        const unassignedTask = await WorkspaceTaskService.setTaskAssignees(
            workspaceId,
            leadUser.id,
            task1.id,
            [memberB.id]
        );

        assert("Current active assignees is 1 (memberB only)", unassignedTask.currentAssignees?.length === 1);
        assert("Active assignee is memberB", unassignedTask.currentAssignees?.[0]?.userId === memberB.id);
        assert("Reassignment history records both assignments", (unassignedTask.reassignmentHistory?.length || 0) >= 2);

        // Verify inactive assignment has unassigned_at timestamp
        const inactiveAssignee = unassignedTask.reassignmentHistory?.find(
            (a) => a.userId === memberA.id && !a.isActive
        );
        assert("Inactive assignee has unassignedAt timestamp", Boolean(inactiveAssignee?.unassignedAt));

        // Restore memberA to task1 assignees
        await WorkspaceTaskService.setTaskAssignees(
            workspaceId,
            leadUser.id,
            task1.id,
            [memberA.id]
        );

        // ---------------------------------------------------------------------
        // TEST SUITE 3: Department Isolation & Restricted Tasks
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 3: Department Isolation & Restricted Tasks");

        // Create a restricted department task
        const restrictedTask = await WorkspaceTaskService.createTask(workspaceId, leadUser.id, {
            title: "Confidential Department Roadmap",
            description: "Internal department strategy and deliverables.",
            departmentId: testDept.id,
            priority: "high",
            isRestricted: true,
            assigneeUserIds: [memberA.id],
        });

        assert("Restricted task created successfully", Boolean(restrictedTask.id));
        assert("Task isRestricted flag is true", restrictedTask.isRestricted === true);

        // Member A (in department) can view task
        const memberAView = await WorkspaceTaskService.getTask(workspaceId, memberA.id, restrictedTask.id);
        assert("Department member can view restricted task", memberAView.id === restrictedTask.id);

        // Department Lead can view task
        const leadView = await WorkspaceTaskService.getTask(workspaceId, leadUser.id, restrictedTask.id);
        assert("Department lead can view restricted task", leadView.id === restrictedTask.id);

        // Workspace Owner can view task
        const ownerView = await WorkspaceTaskService.getTask(workspaceId, club.auth_user_id, restrictedTask.id);
        assert("Workspace owner can view restricted task", ownerView.id === restrictedTask.id);

        // Member B (outside department) CANNOT view restricted task (throws 403)
        let memberBAccessBlocked = false;
        try {
            await WorkspaceTaskService.getTask(workspaceId, memberB.id, restrictedTask.id);
        } catch (err: any) {
            memberBAccessBlocked = err.message.includes("Unauthorized");
        }
        assert("Non-department member is blocked from viewing restricted task", memberBAccessBlocked);

        // List tasks isolation: Member B listing tasks should NOT see the restricted task
        const memberBList = await WorkspaceTaskService.listTasks(workspaceId, memberB.id, {
            departmentId: testDept.id,
        });
        const containsRestricted = memberBList.tasks.some((t) => t.id === restrictedTask.id);
        assert("Restricted task is filtered out from non-member task listing", !containsRestricted);

        // ---------------------------------------------------------------------
        // TEST SUITE 4: Server-Side Status Transition State Machine
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 4: Server-Side Status Transition State Machine");

        // Initial task1 status is 'assigned'
        // Test invalid transition: 'assigned' -> 'approved' directly (must fail)
        let invalidTransitionBlocked = false;
        try {
            await WorkspaceTaskService.transitionTaskStatus(
                workspaceId,
                club.auth_user_id,
                task1.id,
                "approved"
            );
        } catch (err: any) {
            invalidTransitionBlocked = err.message.includes("Invalid status transition");
        }
        assert("Direct transition 'assigned' -> 'approved' is rejected by state machine", invalidTransitionBlocked);

        // Valid transition: 'assigned' -> 'in_progress'
        const inProgTask = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            memberA.id,
            task1.id,
            "in_progress"
        );
        assert("Transition 'assigned' -> 'in_progress' succeeded", inProgTask.status === "in_progress");

        // Valid transition: 'in_progress' -> 'blocked'
        const blockedTask = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            memberA.id,
            task1.id,
            "blocked",
            undefined,
            "Waiting for API specs"
        );
        assert("Transition 'in_progress' -> 'blocked' succeeded", blockedTask.status === "blocked");

        // Valid transition: 'blocked' -> 'in_progress'
        const resumedTask = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            memberA.id,
            task1.id,
            "in_progress"
        );
        assert("Transition 'blocked' -> 'in_progress' succeeded", resumedTask.status === "in_progress");

        // ---------------------------------------------------------------------
        // TEST SUITE 5: Submission & Self-Review Protection
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 5: Submission & Self-Review Protection");

        // Member A submits deliverable
        const submissionResult = await WorkspaceTaskService.submitTask(
            workspaceId,
            memberA.id,
            task1.id,
            "Completed task engine core with transactions and optimistic concurrency.",
            [{ name: "architecture.pdf", url: "https://cloudinary.com/task-arch.pdf" }]
        );

        assert("Submission created with pending status", submissionResult.submission.status === "pending");
        assert("Task transitioned to 'submitted'", submissionResult.task.status === "submitted");

        // SELF-REVIEW PROTECTION TEST:
        // Member A (assignee/submitter) attempts to approve their OWN work.
        // Must be rejected by server!
        let selfApprovalBlocked = false;
        try {
            await WorkspaceTaskService.reviewTask(
                workspaceId,
                memberA.id,
                task1.id,
                submissionResult.submission.id,
                "approved",
                "I approve my own work!"
            );
        } catch (err: any) {
            selfApprovalBlocked = err.message.includes("Self-review policy violation") || err.message.includes("Unauthorized");
        }
        assert("Self-review policy strictly prevents submitter/assignee from approving own work", selfApprovalBlocked);

        // Reviewer: Lead requests changes
        const changeRequestResult = await WorkspaceTaskService.reviewTask(
            workspaceId,
            leadUser.id,
            task1.id,
            submissionResult.submission.id,
            "changes_requested",
            "Please add index optimization on task queries."
        );

        assert("Task status transitioned to 'changes_requested'", changeRequestResult.task.status === "changes_requested");
        assert("Review decision recorded as 'changes_requested'", changeRequestResult.review.decision === "changes_requested");

        // Member A re-submits
        await WorkspaceTaskService.submitTask(
            workspaceId,
            memberA.id,
            task1.id,
            "Added index optimizations as requested."
        );

        // Authorized Lead approves submission
        const approvalResult = await WorkspaceTaskService.reviewTask(
            workspaceId,
            leadUser.id,
            task1.id,
            submissionResult.submission.id,
            "approved",
            "LGTM! Excellent implementation."
        );

        assert("Task status transitioned to 'approved'", approvalResult.task.status === "approved");
        assert("Review decision recorded as 'approved'", approvalResult.review.decision === "approved");

        // Complete the task
        const completedTask = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            leadUser.id,
            task1.id,
            "completed"
        );
        assert("Task transitioned to 'completed'", completedTask.status === "completed");
        assert("Task completed_at is set", Boolean(completedTask.completedAt));

        // ---------------------------------------------------------------------
        // TEST SUITE 6: Optimistic Concurrency Protection
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 6: Optimistic Concurrency Protection");

        const currentTask = await WorkspaceTaskService.getTask(workspaceId, club.auth_user_id, task1.id);
        const staleVersion = currentTask.version - 1; // deliberately stale version

        let concurrencyConflictCaught = false;
        try {
            await WorkspaceTaskService.updateTask(
                workspaceId,
                club.auth_user_id,
                task1.id,
                { title: "Stale update attempt" },
                staleVersion
            );
        } catch (err: any) {
            concurrencyConflictCaught = err.message.includes("Concurrency conflict");
        }
        assert("Stale version update rejected with concurrency conflict error", concurrencyConflictCaught);

        // Correct version update succeeds
        const currentVersion = currentTask.version;
        const validUpdate = await WorkspaceTaskService.updateTask(
            workspaceId,
            club.auth_user_id,
            task1.id,
            { description: "Updated description with matching version." },
            currentVersion
        );
        assert("Valid version update increments version", validUpdate.version === currentVersion + 1);

        // ---------------------------------------------------------------------
        // TEST SUITE 7: Comments, Mentions, Watchers & Activity History
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 7: Comments, Mentions, Watchers & Activity History");

        // Add root comment
        const comment1 = await WorkspaceTaskService.addComment(
            workspaceId,
            leadUser.id,
            task1.id,
            "Great work on this task @task_mem_a!",
            null,
            [memberA.id]
        );
        assert("Task comment created", Boolean(comment1.id));
        assert("Comment author matches lead", comment1.author?.username === leadUser.username);

        // Add reply
        const reply1 = await WorkspaceTaskService.addComment(
            workspaceId,
            memberA.id,
            task1.id,
            "Thank you lead, tests are passing!",
            comment1.id
        );
        assert("Task threaded reply created", Boolean(reply1.id));

        // Get comments hierarchy
        const comments = await WorkspaceTaskService.getComments(workspaceId, club.auth_user_id, task1.id);
        assert("Root comments returned", comments.length >= 1);
        const rootComment = comments.find((c) => c.id === comment1.id);
        assert("Root comment has replies array", Array.isArray(rootComment?.replies));
        assert("Reply is nested under root comment", rootComment?.replies?.[0]?.id === reply1.id);

        // Watchers toggle
        const taskBefore = await WorkspaceTaskService.getTask(workspaceId, club.auth_user_id, task1.id);
        const initialWatching = taskBefore.watchers?.some((w) => w.userId === memberB.id) || false;

        const watchResult1 = await WorkspaceTaskService.toggleWatcher(workspaceId, memberB.id, task1.id);
        assert("Toggling watcher inverts initial watching state", watchResult1.isWatching === !initialWatching);

        const watchResult2 = await WorkspaceTaskService.toggleWatcher(workspaceId, memberB.id, task1.id);
        assert("Toggling watcher again restores initial watching state", watchResult2.isWatching === initialWatching);

        // Task activity audit log
        const activity = await WorkspaceTaskService.getActivity(workspaceId, club.auth_user_id, task1.id);
        assert("Task activity contains entries", activity.length > 0);
        const actionTypes = activity.map((a) => a.action);
        assert("Activity includes 'created'", actionTypes.includes("created"));
        assert("Activity includes 'status_changed'", actionTypes.includes("status_changed"));
        assert("Activity includes 'submitted'", actionTypes.includes("submitted"));
        assert("Activity includes 'reviewed'", actionTypes.includes("reviewed"));

        // ---------------------------------------------------------------------
        // TEST SUITE 8: "My Tasks" Categorized Query Views
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 8: 'My Tasks' Categorized Query Views");

        // Member A queries completed tasks
        const myCompleted = await WorkspaceTaskService.getMyTasks(workspaceId, memberA.id, "completed");
        assert("My Tasks (completed) includes task1", myCompleted.some((t) => t.id === task1.id));

        // Owner queries created_by_me
        const myCreated = await WorkspaceTaskService.getMyTasks(workspaceId, club.auth_user_id, "created_by_me");
        assert("My Tasks (created_by_me) includes task1", myCreated.some((t) => t.id === task1.id));

        // ---------------------------------------------------------------------
        // TEST SUITE 9: Soft-Deletion / Task Archival
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 9: Soft-Deletion / Task Archival");

        const archivedTask = await WorkspaceTaskService.archiveTask(workspaceId, club.auth_user_id, task1.id);
        assert("Task isArchived set to true", archivedTask.isArchived === true);
        assert("Task status is 'archived'", archivedTask.status === "archived");
        assert("Archived at timestamp is set", Boolean(archivedTask.archivedAt));

        // Archived task excluded from active list
        const activeList = await WorkspaceTaskService.listTasks(workspaceId, club.auth_user_id, {
            isArchived: false,
        });
        assert("Archived task excluded from active task listing", !activeList.tasks.some((t) => t.id === task1.id));

        // Archived task included when explicitly requested
        const archivedList = await WorkspaceTaskService.listTasks(workspaceId, club.auth_user_id, {
            isArchived: true,
        });
        assert("Archived task returned when isArchived=true queried", archivedList.tasks.some((t) => t.id === task1.id));

    } catch (err: any) {
        console.error("FATAL SUITE ERROR:", err);
        failed++;
    } finally {
        console.log("\n=================================================================");
        console.log(`PHASE 05 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log("=================================================================\n");
        await redis.quit();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runPhase05Tests();
