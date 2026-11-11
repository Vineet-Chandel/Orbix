// Backend/scripts/test_team_workspace_phase_05.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";

async function runPhase05Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 05 FULL TASK MANAGEMENT TEST SUITE");
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
        // 1. SETUP & PERSONAS
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

        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p5_${roleName}_${randKey}@test.orbix.club`,
                    `p5_${roleName}_${randKey}`,
                    `P5${roleName}`,
                    `Test`,
                ]
            );
            return uRes.rows[0];
        };

        const leadUser = await makeUser("lead");
        const memberA = await makeUser("mem_a"); // In Dept 1
        const memberB = await makeUser("mem_b"); // In Dept 2

        // Create 2 test departments
        const dept1 = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            club.auth_user_id,
            { name: `Engineering P5 ${randKey}`, color: "#4F46E5" }
        );
        const dept2 = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            club.auth_user_id,
            { name: `Design P5 ${randKey}`, color: "#EC4899" }
        );

        const addMemberRecord = async (userId: string, roleId: string) => {
            const res = await query(
                `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, role_title)
                 VALUES ($1, $2, $3, 'Test Member')
                 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = $3
                 RETURNING id;`,
                [workspaceId, userId, roleId]
            );
            return res.rows[0];
        };

        // LeadUser -> Dept 1 Lead
        const leadMember = await addMemberRecord(leadUser.id, deptLeadRole.id);
        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept1.id,
            leadMember.id,
            "lead"
        );

        // MemberA -> Dept 1 Member
        const memAMember = await addMemberRecord(memberA.id, memberRole.id);
        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept1.id,
            memAMember.id,
            "member"
        );

        // MemberB -> Dept 2 Member
        const memBMember = await addMemberRecord(memberB.id, memberRole.id);
        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept2.id,
            memBMember.id,
            "member"
        );

        // =========================================================================
        // PART 1: Task Creation with Validation & Media Attachments
        // =========================================================================
        console.log("PART 1: Task Creation with Validation & Media Attachments");

        // Create a test file in workspace_files
        const fileRes = await query(
            `INSERT INTO public.workspace_files (
                workspace_id, uploader_id, file_name, file_size_bytes, mime_type,
                cloudinary_public_id, cloudinary_asset_id, cloudinary_url, cloudinary_secure_url,
                resource_type, delivery_type, purpose, parent_resource_type
            ) VALUES (
                $1, $2, 'spec_document.pdf', 1048576, 'application/pdf',
                'p5_spec_${randKey}', 'asset_p5_${randKey}', 'http://res.cloudinary.com/doc.pdf', 'https://res.cloudinary.com/doc.pdf',
                'raw', 'authenticated', 'attachment', 'attachment'
            ) RETURNING id;`,
            [workspaceId, leadUser.id]
        );
        const testFileId = fileRes.rows[0].id;

        // Lead creates task for dept 1 with checklist, links, assignees, and fileIds
        const task1 = await WorkspaceTaskService.createTask(workspaceId, leadUser.id, {
            title: `Build API Gateway ${randKey}`,
            description: "Implement zero-trust authentication and rate limits for ingress traffic",
            departmentId: dept1.id,
            priority: "high",
            startDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days
            checklist: [
                { id: "c1", text: "Design OpenAPI specification", isCompleted: false },
                { id: "c2", text: "Implement JWT validation middleware", isCompleted: false },
            ],
            referenceLinks: [
                { title: "Gateway Architecture RFC", url: "https://specs.orbix.club/rfc/gateway" }
            ],
            isRestricted: false,
            assigneeUserIds: [], // initially unassigned -> status is 'draft'
            fileIds: [testFileId],
        });

        assert("Task created successfully with details", Boolean(task1.id && task1.title));
        assert("Initial task status without assignees defaults to 'draft'", task1.status === "draft");

        // Verify file was associated with task
        const linkedFile = await query("SELECT task_id, parent_resource_type FROM public.workspace_files WHERE id = $1;", [testFileId]);
        assert("Uploaded file linked to created task", linkedFile.rows[0]?.task_id === task1.id && linkedFile.rows[0]?.parent_resource_type === "task");

        // Test restricted task creation validation: assigning non-department member should fail
        let nonDeptAssignFailed = false;
        try {
            await WorkspaceTaskService.createTask(workspaceId, leadUser.id, {
                title: `Restricted Core Config ${randKey}`,
                departmentId: dept1.id,
                isRestricted: true,
                assigneeUserIds: [memberB.id], // MemberB belongs to Dept2, NOT Dept1
            });
        } catch (err: any) {
            nonDeptAssignFailed = err.message.includes("does not belong to the restricted department");
        }
        assert("Assigning non-department member to restricted task is rejected", nonDeptAssignFailed);

        // Assigning department member to restricted task succeeds
        const restrictedTask = await WorkspaceTaskService.createTask(workspaceId, leadUser.id, {
            title: `Restricted Dept1 Config ${randKey}`,
            departmentId: dept1.id,
            isRestricted: true,
            assigneeUserIds: [memberA.id],
        });
        assert("Assigning verified department member to restricted task succeeds", Boolean(restrictedTask.id && restrictedTask.isRestricted));

        // =========================================================================
        // PART 2: Task Assignment & Reassignment History
        // =========================================================================
        console.log("\nPART 2: Task Assignment & Reassignment History");

        // Assign memberA to task1
        const initialAssign = await WorkspaceTaskService.setTaskAssignees(
            workspaceId,
            leadUser.id,
            task1.id,
            [memberA.id]
        );
        assert("Task assignee assigned successfully", initialAssign.currentAssignees?.some((a) => a.userId === memberA.id) === true);

        // Reassign task1: Add leadUser, remove memberA
        const reassignedTask = await WorkspaceTaskService.setTaskAssignees(
            workspaceId,
            leadUser.id,
            task1.id,
            [leadUser.id]
        );
        assert("Task reassign updated active assignees", reassignedTask.currentAssignees?.some((a) => a.userId === leadUser.id) === true);
        assert("Previous assignee memberA is no longer active", reassignedTask.currentAssignees?.some((a) => a.userId === memberA.id) === false);

        // Check reassignment history log
        const history = await WorkspaceTaskService.getReassignmentHistory(workspaceId, leadUser.id, task1.id);
        assert("Reassignment history records both active and unassigned records", history.length >= 2);
        assert("Reassignment history contains unassigned memberA", history.some((h) => h.userId === memberA.id && h.isActive === false));
        assert("Reassignment history contains active leadUser", history.some((h) => h.userId === leadUser.id && h.isActive === true));

        // Re-assign memberA back for deliverable workflow testing
        const assignedTask1 = await WorkspaceTaskService.setTaskAssignees(workspaceId, leadUser.id, task1.id, [memberA.id]);

        // Unauthorized member (memberB) cannot reassign task in Dept 1
        let unauthorizedReassignFailed = false;
        try {
            await WorkspaceTaskService.setTaskAssignees(workspaceId, memberB.id, task1.id, [memberB.id]);
        } catch (err: any) {
            unauthorizedReassignFailed = err.message.includes("Unauthorized");
        }
        assert("Unauthorized member cannot reassign department task", unauthorizedReassignFailed);

        // =========================================================================
        // PART 3: Server-Side State Machine Transitions
        // =========================================================================
        console.log("\nPART 3: Server-Side State Machine Transitions");

        // 1. Move draft -> assigned on a draft task
        const draftTask = await WorkspaceTaskService.createTask(workspaceId, leadUser.id, {
            title: "Draft State Machine Test Task",
            priority: "low",
            assigneeUserIds: [],
        });
        const tDraftAssigned = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            leadUser.id,
            draftTask.id,
            "assigned",
            draftTask.version
        );
        assert("Transitioned draft -> assigned", tDraftAssigned.status === "assigned");
        assert("Version incremented on status transition", tDraftAssigned.version > draftTask.version);

        // 2. Move assigned -> in_progress on task1
        const tInProgress = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            memberA.id,
            task1.id,
            "in_progress",
            assignedTask1.version
        );
        assert("Transitioned assigned -> in_progress by assignee", tInProgress.status === "in_progress");
        assert("Version incremented on status transition", tInProgress.version > assignedTask1.version);

        // 3. Test invalid transition: cannot jump from in_progress directly to completed
        let invalidTransitionFailed = false;
        try {
            await WorkspaceTaskService.transitionTaskStatus(
                workspaceId,
                memberA.id,
                task1.id,
                "completed",
                tInProgress.version
            );
        } catch (err: any) {
            invalidTransitionFailed = err.message.includes("Invalid status transition");
        }
        assert("Invalid status transition (in_progress -> completed) is blocked", invalidTransitionFailed);

        // =========================================================================
        // PART 4: Work Deliverable Submission & Revision Preservation
        // =========================================================================
        console.log("\nPART 4: Work Deliverable Submission & Revision Preservation");

        // MemberA submits deliverable #1
        const sub1Result = await WorkspaceTaskService.submitTask(
            workspaceId,
            memberA.id,
            task1.id,
            "Initial PR opened for API Gateway: https://github.com/orbix/gateway/pull/42",
            [{ name: "Test Execution Logs", url: "https://specs.orbix.club/logs.txt" }],
            tInProgress.version
        );
        assert("Deliverable #1 submitted successfully", sub1Result.submission.status === "pending");
        assert("Task transitioned to 'submitted' upon deliverable upload", sub1Result.task.status === "submitted");

        // LeadUser reviews deliverable #1 and requests changes
        const review1Result = await WorkspaceTaskService.reviewTask(
            workspaceId,
            leadUser.id,
            task1.id,
            sub1Result.submission.id,
            "changes_requested",
            "Please add unit tests covering rate-limiting headers and retry-after logic.",
            sub1Result.task.version
        );
        assert("Lead requested changes with feedback comments", review1Result.review.decision === "changes_requested");
        assert("Task transitioned to 'changes_requested'", review1Result.task.status === "changes_requested");

        // MemberA resubmits deliverable #2 (revision)
        const sub2Result = await WorkspaceTaskService.submitTask(
            workspaceId,
            memberA.id,
            task1.id,
            "Revision 2: Added 14 unit tests covering rate limiter and redis failure scenarios.",
            [
                { name: "Coverage Report PDF", url: "https://specs.orbix.club/coverage.pdf" },
                { name: "Updated PR", url: "https://github.com/orbix/gateway/pull/42#v2" },
            ],
            review1Result.task.version
        );
        assert("Deliverable #2 resubmitted after changes requested", sub2Result.submission.status === "pending");
        assert("Task transitioned back to 'submitted'", sub2Result.task.status === "submitted");

        // Verify task details returns both submissions chronologically preserved
        const freshTask = await WorkspaceTaskService.getTask(workspaceId, leadUser.id, task1.id);
        assert("Historical submissions preserved (2 total)", freshTask.submissions?.length === 2);
        assert("Latest submission matches Revision 2", freshTask.latestSubmission?.content.includes("Revision 2") === true);
        assert("First submission has attached review decision", freshTask.submissions?.some((s) => s.review?.decision === "changes_requested") === true);

        // =========================================================================
        // PART 5: Deliverable Review Workflow & Self-Review Policy Enforcement
        // =========================================================================
        console.log("\nPART 5: Deliverable Review Workflow & Self-Review Policy Enforcement");

        // Submitter (memberA) attempts to self-approve their own submission -> MUST FAIL
        let selfReviewFailed = false;
        try {
            await WorkspaceTaskService.reviewTask(
                workspaceId,
                memberA.id,
                task1.id,
                sub2Result.submission.id,
                "approved",
                "Self-approving my code looks good!",
                freshTask.version
            );
        } catch (err: any) {
            selfReviewFailed = err.message.includes("Self-review policy violation");
        }
        assert("Self-review policy blocks submitter from approving own work", selfReviewFailed);

        // LeadUser approves Revision 2
        const review2Result = await WorkspaceTaskService.reviewTask(
            workspaceId,
            leadUser.id,
            task1.id,
            sub2Result.submission.id,
            "approved",
            "LGTM! Excellent test coverage and rate-limit documentation.",
            freshTask.version
        );
        assert("Department Lead approved Revision 2", review2Result.review.decision === "approved");
        assert("Task transitioned to 'approved'", review2Result.task.status === "approved");

        // Move approved -> completed
        const completedTask = await WorkspaceTaskService.transitionTaskStatus(
            workspaceId,
            leadUser.id,
            task1.id,
            "completed",
            review2Result.task.version
        );
        assert("Task transitioned approved -> completed", completedTask.status === "completed");

        // =========================================================================
        // PART 6: Permission-Aware Views & Scoped Listings
        // =========================================================================
        console.log("\nPART 6: Permission-Aware Views & Scoped Listings");

        // List tasks by department
        const dept1List = await WorkspaceTaskService.listTasks(workspaceId, leadUser.id, {
            departmentId: dept1.id,
        });
        assert("listTasks filters by departmentId", dept1List.tasks.some((t) => t.id === task1.id));

        // List tasks by search keyword
        const searchList = await WorkspaceTaskService.listTasks(workspaceId, leadUser.id, {
            search: "Gateway",
        });
        assert("listTasks search returns matching task", searchList.tasks.some((t) => t.id === task1.id));

        // List tasks sorted by title
        const sortedList = await WorkspaceTaskService.listTasks(workspaceId, leadUser.id, {
            sortBy: "title",
            sortDir: "asc",
        });
        assert("listTasks supports title sorting", sortedList.tasks.length > 0);

        // Test getMyTasks tabs:
        // 1. assigned_to_me for memberA
        const myAssigned = await WorkspaceTaskService.getMyTasks(workspaceId, memberA.id, "assigned_to_me");
        assert("getMyTasks(assigned_to_me) returns tasks", Array.isArray(myAssigned));

        // 2. created_by_me for leadUser
        const myCreated = await WorkspaceTaskService.getMyTasks(workspaceId, leadUser.id, "created_by_me");
        assert("getMyTasks(created_by_me) returns lead tasks", myCreated.some((t) => t.id === task1.id));

        // 3. assigned_by_me for leadUser
        const myAssignedBy = await WorkspaceTaskService.getMyTasks(workspaceId, leadUser.id, "assigned_by_me");
        assert("getMyTasks(assigned_by_me) returns tasks assigned by lead", myAssignedBy.some((t) => t.id === task1.id));

        // 4. department_tasks for memberA
        const deptTasks = await WorkspaceTaskService.getMyTasks(workspaceId, memberA.id, "department_tasks");
        assert("getMyTasks(department_tasks) returns dept tasks", deptTasks.some((t) => t.id === task1.id));

        // 5. completed for memberA
        const myCompleted = await WorkspaceTaskService.getMyTasks(workspaceId, memberA.id, "completed");
        assert("getMyTasks(completed) returns completed task", myCompleted.some((t) => t.id === task1.id));

        // =========================================================================
        // PART 7: Collaboration: Checklist, Comments, Watchers & Activity Stream
        // =========================================================================
        console.log("\nPART 7: Collaboration: Checklist, Comments, Watchers & Activity Stream");

        // 1. Checklist update
        const updatedChecklist = await WorkspaceTaskService.updateChecklist(
            workspaceId,
            memberA.id,
            task1.id,
            [
                { id: "c1", text: "Design OpenAPI specification", isCompleted: true },
                { id: "c2", text: "Implement JWT validation middleware", isCompleted: true },
            ],
            completedTask.version
        );
        assert("Checklist items completed and persisted", updatedChecklist.checklist.every((c) => c.isCompleted));

        // 2. Add discussion comment
        const comment = await WorkspaceTaskService.addComment(
            workspaceId,
            memberA.id,
            task1.id,
            "Deployed to staging cluster for QA validation."
        );
        assert("Task comment created", Boolean(comment.id && comment.content));

        // Threaded reply to comment
        const reply = await WorkspaceTaskService.addComment(
            workspaceId,
            leadUser.id,
            task1.id,
            "Verified on staging, QA sign-off granted.",
            comment.id
        );
        assert("Threaded reply created with parentCommentId", reply.parentCommentId === comment.id);

        // 3. Toggle watcher subscription (assignee memberA starts as active watcher)
        const unwatchResult = await WorkspaceTaskService.toggleWatcher(workspaceId, memberA.id, task1.id);
        assert("Watcher toggled to inactive", unwatchResult.isWatching === false);
        const rewatchResult = await WorkspaceTaskService.toggleWatcher(workspaceId, memberA.id, task1.id);
        assert("Watcher toggled back to active", rewatchResult.isWatching === true);

        // 4. Activity stream
        const activities = await WorkspaceTaskService.getActivity(workspaceId, leadUser.id, task1.id);
        assert("Activity stream recorded events", activities.length >= 4);
        assert("Activity stream contains status_changed", activities.some((a) => a.action === "status_changed"));
        assert("Activity stream contains deliverable submission", activities.some((a) => a.action === "submitted"));
        assert("Activity stream contains comment_added", activities.some((a) => a.action === "comment_added"));

        // =========================================================================
        // CLEANUP
        // =========================================================================
        console.log("\nCleaning up test artifacts...");
        await query("DELETE FROM public.workspace_task_activity WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_task_comments WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_task_reviews WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_task_submissions WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_task_assignments WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_task_watchers WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_files WHERE id = $1;", [testFileId]);
        await query("DELETE FROM public.workspace_tasks WHERE workspace_id = $1 AND creator_id IN ($2, $3, $4);", [workspaceId, leadUser.id, memberA.id, memberB.id]);
        await query("DELETE FROM public.workspace_department_members WHERE workspace_id = $1 AND member_id IN ($2, $3, $4);", [workspaceId, leadMember.id, memAMember.id, memBMember.id]);
        await query("DELETE FROM public.workspace_departments WHERE id IN ($1, $2);", [dept1.id, dept2.id]);
        await query("DELETE FROM public.workspace_members WHERE id IN ($1, $2, $3);", [leadMember.id, memAMember.id, memBMember.id]);
        await query("DELETE FROM public.users WHERE id IN ($1, $2, $3);", [leadUser.id, memberA.id, memberB.id]);
        console.log("Cleanup completed.");

    } catch (err: any) {
        console.error("FATAL TEST ERROR:", err);
        failed++;
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 05 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================================\n");

    process.exit(failed > 0 ? 1 : 0);
}

runPhase05Tests();
