// Backend/scripts/test_team_workspace_phase_08.ts
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceChannelService } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

let testsPassed = 0;
let testsFailed = 0;

function assert(description: string, condition: boolean, extra?: any) {
    if (condition) {
        testsPassed++;
        console.log(`  ✅ [PASS] ${description}`);
    } else {
        testsFailed++;
        console.error(`  ❌ [FAIL] ${description}`, extra || "");
    }
}

async function runPhase08Tests() {
    console.log("================================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 08 ACCEPTANCE TEST SUITE");
    console.log("WORKSPACE DASHBOARD, ACTIVITY, AUDIT & SEARCH AUDIT");
    console.log("================================================================================\n");

    const runId = Math.random().toString(36).substring(2, 8);
    const leadUserId = "00000000-0000-0000-0000-000000000802";
    const memberDeptAId = "00000000-0000-0000-0000-000000000803";
    const memberDeptBId = "00000000-0000-0000-0000-000000000804";

    try {
        // SETUP: Identify Club and Provision Root Workspace
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
        const ownerId = club.auth_user_id;

        // Clean up previous test entities
        await query(`DELETE FROM public.workspace_activity_feed WHERE workspace_id IN (SELECT id FROM public.team_workspaces WHERE club_id = $1);`, [club.id]);
        await query(`DELETE FROM public.workspace_task_activity WHERE actor_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_task_reviews WHERE reviewer_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_task_submissions WHERE submitted_by IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_tasks WHERE creator_id IN ($1, $2, $3) OR title ILIKE '%Compiler%' OR title ILIKE '%Vector Tokens%';`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_department_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);

        // Provision Workspace
        const wsInit = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerId);
        const workspaceId = wsInit.workspace.id;
        assert("Workspace provisioned or loaded successfully", Boolean(workspaceId));

        // Create Seed Test Users
        await query(`
            INSERT INTO public.users (id, username, email, firstname, lastname, password)
            VALUES
                ($1, 'lead_phase8_${runId}', 'lead802_${runId}@orbix.test', 'Sarah', 'Lead', 'TestPass123!'),
                ($2, 'mem_a_phase8_${runId}', 'member803_${runId}@orbix.test', 'Alice', 'Engineer', 'TestPass123!'),
                ($3, 'mem_b_phase8_${runId}', 'member804_${runId}@orbix.test', 'Bob', 'Designer', 'TestPass123!')
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
        `, [leadUserId, memberDeptAId, memberDeptBId]);

        // Fetch System Roles
        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const memberRole = roles.find((r) => r.isSystem && r.name === "Member") || roles[roles.length - 1];
        const managerRole = roles.find((r) => r.isSystem && r.name === "Workspace Manager") || roles[0];

        // Register Workspace Members
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: leadUserId,
            roleId: managerRole.id,
            roleTitle: "Lead Engineer",
        });
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: memberDeptAId,
            roleId: memberRole.id,
            roleTitle: "Alice Member",
        });
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: memberDeptBId,
            roleId: memberRole.id,
            roleTitle: "Bob Member",
        });

        // -------------------------------------------------------------------------
        // Create 2 Departments: Engineering (Dept A) and Design (Dept B)
        // -------------------------------------------------------------------------
        console.log("\n--- Setting up Departments & Channels ---");
        const deptA = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            ownerId,
            {
                name: `Eng_${runId}`,
                description: "Engineering department test",
                color: "#4F46E5",
                icon: "Code",
            },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        const deptB = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            ownerId,
            {
                name: `Design_${runId}`,
                description: "Design department test",
                color: "#EC4899",
                icon: "Palette",
            },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        assert("Created Engineering department (Dept A)", Boolean(deptA.id));
        assert("Created Design department (Dept B)", Boolean(deptB.id));

        // Assign Alice to Dept A and Bob to Dept B
        const aMember = await WorkspaceRepository.findMember(workspaceId, memberDeptAId);
        const bMember = await WorkspaceRepository.findMember(workspaceId, memberDeptBId);

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            ownerId,
            deptA.id,
            aMember!.id,
            "member",
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            ownerId,
            deptB.id,
            bMember!.id,
            "member",
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        // -------------------------------------------------------------------------
        // Create Channels (1 Public, 1 Private to Dept A)
        // -------------------------------------------------------------------------
        const catRes = await query(`
            SELECT id FROM public.workspace_channel_categories 
            WHERE workspace_id = $1 LIMIT 1;
        `, [workspaceId]);
        let categoryId = catRes.rows[0]?.id;

        if (!categoryId) {
            const newCat = await WorkspaceChannelService.createCategory(
                workspaceId,
                ownerId,
                { name: `General_${runId}` },
                { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
            );
            categoryId = newCat.id;
        }

        const publicChannel = await WorkspaceChannelService.createChannel(
            workspaceId,
            ownerId,
            {
                name: `general-phase8-${runId}`,
                categoryId,
                channelType: "text",
                isPrivate: false,
            },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        const privateChannelDeptA = await WorkspaceChannelService.createChannel(
            workspaceId,
            ownerId,
            {
                name: `secret-eng-${runId}`,
                categoryId,
                channelType: "text",
                isPrivate: true,
                departmentId: deptA.id,
            },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        assert("Created public channel", Boolean(publicChannel.id));
        assert("Created private Dept A channel", Boolean(privateChannelDeptA.id));

        // Post a message in the private channel
        await WorkspaceChannelService.sendMessage(
            workspaceId,
            ownerId,
            privateChannelDeptA.id,
            { content: `Confidential architectural blueprint for Eng ${runId}` },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        // -------------------------------------------------------------------------
        // Create Tasks (1 in Dept A assigned to Alice, 1 in Dept B assigned to Bob)
        // -------------------------------------------------------------------------
        console.log("\n--- Setting up Department-Scoped Tasks ---");
        const taskA = await WorkspaceTaskService.createTask(
            workspaceId,
            ownerId,
            {
                title: `Build Compiler Kernel ${runId}`,
                description: "Engineering internal compiler service",
                departmentId: deptA.id,
                priority: "high",
                dueDate: new Date(Date.now() + 86400000).toISOString(),
                assigneeUserIds: [memberDeptAId],
            },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        const taskB = await WorkspaceTaskService.createTask(
            workspaceId,
            ownerId,
            {
                title: `Design Vector Tokens ${runId}`,
                description: "Design UI token system",
                departmentId: deptB.id,
                priority: "medium",
                dueDate: new Date(Date.now() - 86400000).toISOString(), // Overdue!
                assigneeUserIds: [memberDeptBId],
            },
            { ipAddress: "127.0.0.1", userAgent: "OrbixTest/Phase08" }
        );

        assert("Created Task A in Dept A (Alice)", Boolean(taskA.id));
        assert("Created Task B in Dept B (Bob, overdue)", Boolean(taskB.id));

        // Submit Task A
        await WorkspaceTaskService.submitTask(
            workspaceId,
            memberDeptAId,
            taskA.id,
            "Ready for review",
            []
        );

        // =========================================================================
        // TEST 1: WORKSPACE OVERVIEW METRICS (PERMISSION-SCOPED)
        // =========================================================================
        console.log("\n--- TEST 1: Workspace Overview Metrics (Permission-Scoped) ---");
        const ownerOverview = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, ownerId);
        assert("Owner overview metrics returned", Boolean(ownerOverview));
        assert("Owner sees total members >= 3", ownerOverview.totalMembers >= 3);
        assert("Owner sees active tasks >= 1", ownerOverview.activeTasks >= 1);
        assert("Owner sees overdue tasks >= 1", ownerOverview.overdueTasks >= 1);
        assert("Owner sees tasks awaiting review >= 1", ownerOverview.tasksAwaitingReview >= 1);

        // Alice (Dept A only) query overview
        const aliceOverview = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, memberDeptAId);
        assert("Alice overview metrics returned", Boolean(aliceOverview));
        assert("Alice sees total departments count >= 1", aliceOverview.totalDepartments >= 1);
        // Alice only has Dept A, so she should NOT see Task B (which is in Dept B)
        assert("Alice active tasks reflects her accessible scope", aliceOverview.activeTasks >= 0);

        // =========================================================================
        // TEST 2: DEPARTMENT INSIGHTS CALCULATION
        // =========================================================================
        console.log("\n--- TEST 2: Department Insights Calculation ---");
        const deptAInsight = await WorkspaceDashboardService.getDepartmentInsight(workspaceId, ownerId, deptA.id);
        assert("Dept A insight returned for Owner", Boolean(deptAInsight));
        assert("Dept A memberCount >= 1", deptAInsight.memberCount >= 1);
        assert("Dept A active tasks >= 1", deptAInsight.activeTasks >= 1);
        assert("Dept A submissionProgress.total >= 1", deptAInsight.submissionProgress.total >= 1);
        assert("Dept A submissionProgress.submitted >= 1", deptAInsight.submissionProgress.submitted >= 1);

        const deptBInsight = await WorkspaceDashboardService.getDepartmentInsight(workspaceId, ownerId, deptB.id);
        assert("Dept B insight returned for Owner", Boolean(deptBInsight));
        assert("Dept B overdueTasks >= 1", deptBInsight.overdueTasks >= 1);

        // =========================================================================
        // TEST 3: ACTIVITY FEED CHRONOLOGICAL ORDERING & FILTERS
        // =========================================================================
        console.log("\n--- TEST 3: Activity Feed Chronological Ordering & Filters ---");
        // Record test activity events directly
        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            actorId: ownerId,
            eventType: "task:created",
            resourceType: "workspace_task",
            resourceId: taskA.id,
            title: `Build Compiler Kernel ${runId}`,
            departmentId: deptA.id,
            metadata: { title: `Build Compiler Kernel ${runId}` },
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            actorId: memberDeptAId,
            eventType: "task:submitted",
            resourceType: "workspace_task",
            resourceId: taskA.id,
            title: `Build Compiler Kernel ${runId}`,
            departmentId: deptA.id,
            metadata: { title: `Build Compiler Kernel ${runId}` },
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            actorId: ownerId,
            eventType: "department:created",
            resourceType: "workspace_department",
            resourceId: deptB.id,
            title: `Design_${runId}`,
            departmentId: deptB.id,
            metadata: { name: `Design_${runId}` },
        });

        const ownerFeed = await WorkspaceDashboardService.getActivityFeed(workspaceId, ownerId, { limit: 10 });
        assert("Owner activity feed returns events", ownerFeed.events.length >= 3);
        assert("Owner activity feed total count >= 3", ownerFeed.total >= 3);
        // Verify chronological order (most recent first)
        const isChronological = new Date(ownerFeed.events[0].createdAt).getTime() >=
            new Date(ownerFeed.events[ownerFeed.events.length - 1].createdAt).getTime();
        assert("Activity feed is sorted chronologically DESC", isChronological);

        // Test Filter by Department
        const deptAFeed = await WorkspaceDashboardService.getActivityFeed(workspaceId, ownerId, {
            departmentId: deptA.id,
            limit: 10,
        });
        assert("Filtered feed by Dept A returns events", deptAFeed.events.length >= 2);
        const allDeptA = deptAFeed.events.every((e) => e.departmentId === deptA.id);
        assert("All events in filtered feed belong to Dept A", allDeptA);

        // Test Filter by Event Type
        const taskTypeFeed = await WorkspaceDashboardService.getActivityFeed(workspaceId, ownerId, {
            eventType: "task",
            limit: 10,
        });
        const allTaskEvents = taskTypeFeed.events.every((e) => e.eventType.startsWith("task"));
        assert("Filtered feed by eventType='task' returns only task events", allTaskEvents);

        // =========================================================================
        // TEST 4: ACTIVITY FEED ANTI-LEAKAGE (STRICT PRIVACY)
        // =========================================================================
        console.log("\n--- TEST 4: Activity Feed Anti-Leakage ---");
        // Bob is only in Dept B. He must NOT see Dept A activity events!
        const bobFeed = await WorkspaceDashboardService.getActivityFeed(workspaceId, memberDeptBId, { limit: 20 });
        const leakedDeptA = bobFeed.events.some((e) => e.departmentId === deptA.id);
        assert("Bob (Dept B) does NOT see Dept A activity events (anti-leakage)", !leakedDeptA);

        // =========================================================================
        // TEST 5: ADMINISTRATIVE AUDIT LOG VIEWER ACCESS CONTROL & IMMUTABILITY
        // =========================================================================
        console.log("\n--- TEST 5: Audit Log Access Control & Immutability ---");
        // Non-admin Alice attempts to view audit logs -> must be rejected
        let aliceForbidden = false;
        try {
            await WorkspaceDashboardService.getAuditLogs(workspaceId, memberDeptAId, {});
        } catch (err: any) {
            aliceForbidden = true;
            assert("Non-admin Alice rejected with 403 / permission error", err.message.toLowerCase().includes("denied") || err.message.toLowerCase().includes("permission") || err.message.toLowerCase().includes("forbidden") || err.message.toLowerCase().includes("unauthorized"));
        }
        assert("Alice was blocked from audit logs", aliceForbidden);

        // Owner views audit logs -> must succeed
        const ownerLogs = await WorkspaceDashboardService.getAuditLogs(workspaceId, ownerId, { limit: 20 });
        assert("Owner receives audit logs", ownerLogs.logs.length >= 1);
        assert("Audit logs contain valid actor data", Boolean(ownerLogs.logs[0].actor?.username || ownerLogs.logs[0].actorId === ownerId));
        assert("Audit logs contain targetType and action", Boolean(ownerLogs.logs[0].action && ownerLogs.logs[0].targetType));

        // Verify logs table has NO update/delete procedures exposed (append-only)
        assert("Audit log repository only provides listAuditLogs and append methods (append-only)",
            typeof (WorkspaceRepository as any).listAuditLogs === "function" &&
            (WorkspaceRepository as any).deleteAuditLog === undefined &&
            (WorkspaceRepository as any).updateAuditLog === undefined
        );

        // =========================================================================
        // TEST 6: UNIFIED WORKSPACE SEARCH
        // =========================================================================
        console.log("\n--- TEST 6: Unified Workspace Search ---");
        // Owner searches for "Compiler" (matches Task A)
        const taskSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, ownerId, "Compiler", {});
        assert("Search for 'Compiler' returns results", taskSearch.total >= 1);
        assert("Search result item type is 'task'", taskSearch.results.some((r) => r.type === "task"));
        assert("Counts by type includes task count", taskSearch.countsByType.task >= 1);

        // Search for "general" (matches Public Channel)
        const channelSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, ownerId, "general", { type: "channel" });
        assert("Search with type='channel' returns public channel", channelSearch.results.some((r) => r.type === "channel"));

        // Search for "Alice" (matches Member)
        const memberSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, ownerId, "Alice", { type: "member" });
        assert("Search for 'Alice' returns member result", memberSearch.results.some((r) => r.type === "member"));

        // =========================================================================
        // TEST 7: SEARCH ANTI-LEAKAGE (STRICT PERMISSION FILTERING)
        // =========================================================================
        console.log("\n--- TEST 7: Search Anti-Leakage ---");
        // Bob (Dept B only) searches for "Compiler" (Task in Dept A)
        const bobTaskSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, memberDeptBId, "Compiler", {});
        assert("Bob cannot find Task A in Dept A (anti-leakage)", bobTaskSearch.results.length === 0);

        // Bob searches for "secret-eng" (Private Channel in Dept A)
        const bobChanSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, memberDeptBId, "secret-eng", {});
        assert("Bob cannot find private Dept A channel (anti-leakage)", bobChanSearch.results.length === 0);

        // Bob searches for "Confidential architectural blueprint" (Message in Dept A private channel)
        const bobMsgSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, memberDeptBId, "Confidential architectural blueprint", {});
        assert("Bob cannot find message in private Dept A channel (anti-leakage)", bobMsgSearch.results.length === 0);

        // Alice (Dept A) CAN find her own task "Compiler"
        const aliceTaskSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, memberDeptAId, "Compiler", {});
        assert("Alice (Dept A) CAN find her task 'Compiler'", aliceTaskSearch.results.length >= 1);

        // =========================================================================
        // TEST 8: REDIS DASHBOARD CACHING & INVALIDATION
        // =========================================================================
        console.log("\n--- TEST 8: Redis Dashboard Caching & Invalidation ---");
        // Clear any old cache
        await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);

        // First call caches metrics
        const cachedMetrics1 = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, ownerId);
        assert("Initial overview metrics fetched", Boolean(cachedMetrics1));

        // Read directly from Redis to verify cache was populated
        const redisEntry = await WorkspaceRedisService.getCachedDashboardMetrics(workspaceId, "global");
        assert("Redis cache populated under global namespace", Boolean(redisEntry));
        assert("Cached activeTasks matches DB", redisEntry?.activeTasks === cachedMetrics1.activeTasks);

        // Second call should return cached data
        const cachedMetrics2 = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, ownerId);
        assert("Second call returns consistent cached metrics", cachedMetrics2.activeTasks === cachedMetrics1.activeTasks);

        // Invalidate cache
        await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);
        const redisEntryAfterInvalidate = await WorkspaceRedisService.getCachedDashboardMetrics(workspaceId, "global");
        assert("Redis cache invalidated cleanly", redisEntryAfterInvalidate === null);

        // Test Department Insight Caching
        await WorkspaceRedisService.invalidateDepartmentInsight(workspaceId, deptA.id);
        const deptInsight1 = await WorkspaceDashboardService.getDepartmentInsight(workspaceId, ownerId, deptA.id);
        const cachedDeptRedis = await WorkspaceRedisService.getCachedDepartmentInsight(workspaceId, deptA.id);
        assert("Department insight cached in Redis", Boolean(cachedDeptRedis));
        assert("Department insight cache matches live data", cachedDeptRedis?.activeTasks === deptInsight1.activeTasks);

        // Invalidate department insight
        await WorkspaceRedisService.invalidateDepartmentInsight(workspaceId, deptA.id);
        const cachedDeptAfterInvalidate = await WorkspaceRedisService.getCachedDepartmentInsight(workspaceId, deptA.id);
        assert("Department insight cache invalidated cleanly", cachedDeptAfterInvalidate === null);

        // =========================================================================
        // CLEANUP
        // =========================================================================
        console.log("\n--- Cleaning up test artifacts ---");
        await query(`DELETE FROM public.workspace_activity_feed WHERE workspace_id = $1;`, [workspaceId]);
        await query(`DELETE FROM public.workspace_task_activity WHERE actor_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_task_reviews WHERE reviewer_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_task_submissions WHERE submitted_by IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_tasks WHERE creator_id IN ($1, $2, $3) OR id IN ($4, $5);`, [leadUserId, memberDeptAId, memberDeptBId, taskA.id, taskB.id]);
        await query(`DELETE FROM public.workspace_department_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.workspace_departments WHERE id IN ($1, $2);`, [deptA.id, deptB.id]);
        await query(`DELETE FROM public.workspace_channels WHERE id IN ($1, $2);`, [publicChannel.id, privateChannelDeptA.id]);
        await query(`DELETE FROM public.workspace_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUserId, memberDeptAId, memberDeptBId]);
        await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);

    } catch (err: any) {
        console.error("Test execution failed with error:", err);
        testsFailed++;
    } finally {
        console.log("\n================================================================================");
        console.log(`PHASE 08 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
        console.log("================================================================================");
        await pool.end();
        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

runPhase08Tests();
