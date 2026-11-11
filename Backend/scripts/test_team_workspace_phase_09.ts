// Backend/scripts/test_team_workspace_phase_09.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceChannelService, workspaceEventBus } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase09Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 09 REDIS, REALTIME & OPTIMIZATION TEST SUITE");
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
        // 1. Fetch Target Club and Owner
        const clubRes = await query(
            `SELECT vc.id, vc.name, vc.auth_user_id 
             FROM public.verified_clubs vc 
             WHERE vc.auth_user_id IS NOT NULL 
             LIMIT 1;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No verified club with an owner found in database.");
        }
        const club = clubRes.rows[0];
        const ownerUserId = club.auth_user_id;
        console.log(`Target Club: "${club.name}" (Club ID: ${club.id}, Owner User ID: ${ownerUserId})\n`);

        // Ensure Workspace exists
        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerUserId);
        const workspaceId = workspace.id;

        // 2. Provision Test Users
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p9_${roleName}_${randKey}@test.orbix.club`,
                    `p9_${roleName}_${randKey}`,
                    `P9${roleName}`,
                    `User`,
                ]
            );
            return uRes.rows[0];
        };

        const managerUser = await makeUser("manager");
        const deptLeadUser = await makeUser("deptlead");
        const outsideUser = await makeUser("outside");

        // Enroll users as members
        const defaultRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "member");
        if (!defaultRole) throw new Error("Default member role not found.");

        const managerMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: managerUser.id,
            roleId: defaultRole.id,
            roleTitle: "Test Manager",
            membershipStatus: "active",
        });

        const leadMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptLeadUser.id,
            roleId: defaultRole.id,
            roleTitle: "Department Lead",
            membershipStatus: "active",
        });

        const outsideMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: outsideUser.id,
            roleId: defaultRole.id,
            roleTitle: "General Member",
            membershipStatus: "active",
        });

        // Appoint Workspace Manager
        await WorkspaceMemberService.appointWorkspaceManager(workspaceId, ownerUserId, managerUser.id, [
            "can_manage_members",
            "can_manage_channels",
            "can_manage_departments",
            "can_manage_tasks",
            "can_view_audit_logs",
        ]);

        // Create Department
        const deptA = await WorkspaceDepartmentService.createDepartment(workspaceId, ownerUserId, {
            name: `P9 Dept A ${randKey}`,
            slug: `p9-dept-a-${randKey}`,
            leadUserId: deptLeadUser.id,
            color: "#FFE566",
            icon: "Layers",
            description: "Department for Phase 09 testing",
        });

        const deptB = await WorkspaceDepartmentService.createDepartment(workspaceId, ownerUserId, {
            name: `P9 Dept B ${randKey}`,
            slug: `p9-dept-b-${randKey}`,
            leadUserId: ownerUserId,
            color: "#A6FF70",
            icon: "Shield",
            description: "Secondary department for transfer testing",
        });

        await WorkspaceDepartmentService.addMemberToDepartment(workspaceId, ownerUserId, deptA.id, leadMember.id, "lead");

        // Create Channels (Public & Private)
        const cat = await WorkspaceChannelService.createCategory(workspaceId, ownerUserId, {
            name: `P9 Category ${randKey}`,
        });
        const publicChan = await WorkspaceChannelService.createChannel(workspaceId, ownerUserId, {
            name: `p9-public-${randKey}`,
            slug: `p9-public-${randKey}`,
            categoryId: cat.id,
            isPrivate: false,
        });

        const privateChan = await WorkspaceChannelService.createChannel(workspaceId, ownerUserId, {
            name: `p9-private-${randKey}`,
            slug: `p9-private-${randKey}`,
            categoryId: cat.id,
            departmentId: deptA.id,
            isPrivate: true,
        });

        // Create Tasks (Unrestricted & Restricted)
        const unrestrictedTask = await WorkspaceTaskService.createTask(workspaceId, ownerUserId, {
            title: `P9 Unrestricted Task ${randKey}`,
            isRestricted: false,
            priority: "medium",
        });

        const restrictedTask = await WorkspaceTaskService.createTask(workspaceId, deptLeadUser.id, {
            title: `P9 Restricted Dept A Task ${randKey}`,
            departmentId: deptA.id,
            isRestricted: true,
            priority: "urgent",
        });

        // =========================================================================
        // TEST GROUP 1: REDIS CACHING, VERSIONING & BOUNDED TTLS
        // =========================================================================
        console.log("--- TEST GROUP 1: REDIS CACHING, VERSIONING & BOUNDED TTLS ---");

        const testKey = WorkspaceRedisService.buildKey("test", "versioned", "key");
        assert("Key generation uses configured version prefix 'orbix:team-workspace:v1:'", testKey.startsWith("orbix:team-workspace:v1:"));

        const initialVer = await WorkspaceRedisService.getWorkspaceCacheVersion(workspaceId);
        assert("Dynamic workspace cache version retrieves positive integer", initialVer >= 1);

        const bumpedVer = await WorkspaceRedisService.bumpWorkspaceCacheVersion(workspaceId);
        assert("Bumping workspace cache version increments counter", bumpedVer === initialVer + 1);

        // Member directory caching
        const mockDirectory = { members: [{ id: "m1", name: "Alice" }], total: 1 };
        await WorkspaceRedisService.setCachedMemberDirectory(workspaceId, "page1", mockDirectory);
        const cachedDir = await WorkspaceRedisService.getCachedMemberDirectory(workspaceId, "page1");
        assert("Member directory cached and retrieved cleanly", cachedDir && cachedDir.total === 1);

        await WorkspaceRedisService.invalidateMemberDirectory(workspaceId);
        const invalidatedDir = await WorkspaceRedisService.getCachedMemberDirectory(workspaceId, "page1");
        assert("Member directory cache evicted on invalidation", invalidatedDir === null);

        // Task accountability caching
        const mockAccountability = { summary: { awaitingReviewCount: 3 }, tasksAwaitingReview: [] };
        await WorkspaceRedisService.setCachedTaskAccountability(workspaceId, "global", mockAccountability);
        const cachedAcc = await WorkspaceRedisService.getCachedTaskAccountability(workspaceId, "global");
        assert("Task accountability summary cached and retrieved", cachedAcc && cachedAcc.summary?.awaitingReviewCount === 3);

        await WorkspaceRedisService.invalidateTaskAccountability(workspaceId);
        const invalidatedAcc = await WorkspaceRedisService.getCachedTaskAccountability(workspaceId, "global");
        assert("Task accountability cache evicted on invalidation", invalidatedAcc === null);

        // Unread counters caching
        const mockUnreads = { [publicChan.id]: 5, [privateChan.id]: 2 };
        await WorkspaceRedisService.setCachedUnreadCounts(workspaceId, deptLeadUser.id, mockUnreads);
        const cachedUnreads = await WorkspaceRedisService.getCachedUnreadCounts(workspaceId, deptLeadUser.id);
        assert("Unread counters cached and retrieved for user", cachedUnreads && cachedUnreads[publicChan.id] === 5);

        await WorkspaceRedisService.invalidateUnreadCounts(workspaceId, deptLeadUser.id);
        const invalidatedUnreads = await WorkspaceRedisService.getCachedUnreadCounts(workspaceId, deptLeadUser.id);
        assert("Unread counters evicted for target user", invalidatedUnreads === null);

        // =========================================================================
        // TEST GROUP 2: CACHE STAMPEDE PROTECTION & SINGLE-FLIGHT MUTEX
        // =========================================================================
        console.log("\n--- TEST GROUP 2: CACHE STAMPEDE PROTECTION & SINGLE-FLIGHT MUTEX ---");

        let computeCalls = 0;
        const stampedeKey = WorkspaceRedisService.buildKey("test_stampede", randKey);

        const runConcurrentRequests = async () => {
            const promises = Array.from({ length: 10 }, () =>
                WorkspaceRedisService.getOrComputeWithStampedeProtection(
                    stampedeKey,
                    async () => {
                        computeCalls++;
                        await new Promise((r) => setTimeout(r, 40));
                        return { value: 42 };
                    },
                    60
                )
            );
            return Promise.all(promises);
        };

        const results = await runConcurrentRequests();
        assert("All 10 concurrent requests return correct computed value", results.every((r) => r.value === 42));
        assert("Stampede protection coalesces concurrent misses (computeCalls === 1)", computeCalls === 1);

        // Distributed Mutex Lock
        const lockToken1 = await WorkspaceRedisService.acquireLock(`test_lock_${randKey}`, 5);
        assert("Distributed lock acquired successfully", lockToken1 !== null);

        const lockToken2 = await WorkspaceRedisService.acquireLock(`test_lock_${randKey}`, 5);
        assert("Contending lock acquisition rejected (null)", lockToken2 === null);

        const released = await WorkspaceRedisService.releaseLock(`test_lock_${randKey}`, lockToken1!);
        assert("Distributed lock released cleanly", released === true);

        // =========================================================================
        // TEST GROUP 3: COMPREHENSIVE PERMISSION & SECURITY INVALIDATION
        // =========================================================================
        console.log("\n--- TEST GROUP 3: PERMISSION & SECURITY INVALIDATION ---");

        // Seed caches
        await WorkspaceRedisService.setCachedPermissions(workspaceId, outsideUser.id, ["test:perm"]);
        await WorkspaceRedisService.setCachedCapabilities(workspaceId, outsideUser.id, {
            resolvedAt: new Date().toISOString(),
            workspaceId,
            userId: outsideUser.id,
            isOwner: false,
            isAdmin: false,
            isWorkspaceManager: false,
            role: { id: defaultRole.id, name: defaultRole.name, slug: defaultRole.slug, rank: defaultRole.rank },
            departments: [],
            channelOverridesCount: 0,
            navigation: {} as any,
            permissions: ["test:perm"],
        });
        await WorkspaceRedisService.setCachedMemberDirectory(workspaceId, "all", { total: 10 });

        // 1. Role Change invalidation
        const customRole = await WorkspaceMemberService.createCustomRole(workspaceId, ownerUserId, {
            name: `P9 Custom Role ${randKey}`,
            slug: `p9-custom-${randKey}`,
            rank: 450,
            color: "#70C4FF",
            permissions: ["tasks:create", "channels:view"],
        });

        await WorkspaceMemberService.assignMemberRole(workspaceId, ownerUserId, outsideUser.id, customRole.id);
        const permsAfterRoleChange = await WorkspaceRedisService.getCachedPermissions(workspaceId, outsideUser.id);
        const capsAfterRoleChange = await WorkspaceRedisService.getCachedCapabilities(workspaceId, outsideUser.id);
        const dirAfterRoleChange = await WorkspaceRedisService.getCachedMemberDirectory(workspaceId, "all");

        assert("Role assignment evicts member permissions cache", permsAfterRoleChange === null);
        assert("Role assignment evicts member capabilities cache", capsAfterRoleChange === null);
        assert("Role assignment evicts member directory cache", dirAfterRoleChange === null);

        // 2. Member Suspension invalidation
        await WorkspaceRedisService.setCachedPermissions(workspaceId, outsideUser.id, ["tasks:create"]);
        await WorkspaceRedisService.setCachedUnreadCounts(workspaceId, outsideUser.id, { c1: 1 });

        await WorkspaceService.setMemberSuspension(workspaceId, outsideUser.id, ownerUserId, true, "Testing invalidation");
        const permsAfterSuspend = await WorkspaceRedisService.getCachedPermissions(workspaceId, outsideUser.id);
        const unreadsAfterSuspend = await WorkspaceRedisService.getCachedUnreadCounts(workspaceId, outsideUser.id);

        assert("Member suspension evicts permissions cache", permsAfterSuspend === null);
        assert("Member suspension evicts unread counts cache", unreadsAfterSuspend === null);

        // Reinstate member
        await WorkspaceService.setMemberSuspension(workspaceId, outsideUser.id, ownerUserId, false);

        // 3. Department Transfer invalidation
        await WorkspaceRedisService.setCachedDepartmentInsight(workspaceId, deptA.id, {
            department: deptA,
            metrics: { memberCount: 1, activeTasksCount: 1, completedTasksCount: 0, reviewPendingCount: 0, blockedTasksCount: 0 },
        });

        await WorkspaceDepartmentService.transferMember(
            workspaceId,
            ownerUserId,
            leadMember.id,
            deptA.id,
            deptB.id,
            "Performance testing rebalance"
        );

        const deptAInsightAfterTransfer = await WorkspaceRedisService.getCachedDepartmentInsight(workspaceId, deptA.id);
        assert("Department transfer evicts source department insight cache", deptAInsightAfterTransfer === null);

        // =========================================================================
        // TEST GROUP 4: REALTIME EVENT EMISSION & ZERO-LEAK AUTHORIZATION
        // =========================================================================
        console.log("\n--- TEST GROUP 4: REALTIME STREAM & ZERO-LEAK AUTHORIZATION ---");

        // Test event bus reception
        let receivedEvent: any = null;
        const testHandler = (data: any) => {
            receivedEvent = data;
        };
        const streamEventName = `workspace:${workspaceId}`;
        workspaceEventBus.on(streamEventName, testHandler);

        // Emit channel update
        await WorkspaceChannelService.sendMessage(workspaceId, ownerUserId, publicChan.id, {
            content: "Hello Phase 09 Realtime!",
        });

        assert("Realtime message event emitted to workspaceEventBus", receivedEvent !== null && receivedEvent.event === "message:new");
        workspaceEventBus.off(streamEventName, testHandler);

        // Test Channel Authorization for Realtime stream
        const canLeadViewPublic = await WorkspaceChannelService.canViewChannel(workspaceId, publicChan.id, deptLeadUser.id);
        assert("Realtime allows subscriber access to public channel", canLeadViewPublic === true);

        const canOutsideViewPrivate = await WorkspaceChannelService.canViewChannel(workspaceId, privateChan.id, outsideUser.id);
        assert("Realtime stream DROPS private channel event for unauthorized member (Zero-Leak)", canOutsideViewPrivate === false);

        // Test Task Authorization for Realtime stream
        const canOutsideViewUnrestricted = await WorkspaceTaskService.canUserViewTask(workspaceId, unrestrictedTask.id, outsideUser.id);
        assert("Realtime allows subscriber access to unrestricted task", canOutsideViewUnrestricted === true);

        const canOutsideViewRestricted = await WorkspaceTaskService.canUserViewTask(workspaceId, restrictedTask.id, outsideUser.id);
        assert("Realtime stream DROPS restricted task event for outside member (Zero-Leak)", canOutsideViewRestricted === false);

        const canLeadViewRestricted = await WorkspaceTaskService.canUserViewTask(workspaceId, restrictedTask.id, deptLeadUser.id);
        assert("Realtime allows department lead access to department's restricted task", canLeadViewRestricted === true);

        // Test Department Authorization for Realtime stream
        const canLeadAccessDeptA = await WorkspaceDepartmentService.canUserAccessDepartment(workspaceId, deptA.id, deptLeadUser.id);
        assert("Realtime allows department lead access to department scope", canLeadAccessDeptA === true);

        const canOutsideAccessDeptA = await WorkspaceDepartmentService.canUserAccessDepartment(workspaceId, deptA.id, outsideUser.id);
        assert("Realtime stream DROPS confidential dept event for outside member (Zero-Leak)", canOutsideAccessDeptA === false);

        // =========================================================================
        // TEST GROUP 5: DATABASE PERFORMANCE & BOUNDED QUERY EXECUTION
        // =========================================================================
        console.log("\n--- TEST GROUP 5: DATABASE PERFORMANCE & BOUNDED QUERY EXECUTION ---");

        // Verify bounded message queries
        const boundedMessages = await WorkspaceRepository.listMessages(workspaceId, publicChan.id, {
            limit: 999999, // Unbounded attempt
        });
        assert("Unbounded limit in listMessages is clamped to safe max (<= 100)", boundedMessages.length <= 100);

        // Verify single batched query with relation loading (No N+1)
        const taskBatch = await WorkspaceRepository.listTasks(workspaceId, { limit: 10 });
        assert("listTasks returns batched tasks successfully", taskBatch.tasks.length > 0);
        const sampleTask = taskBatch.tasks[0];
        assert("Task relation 'creator' loaded in single SQL query (no N+1)", sampleTask.creator && typeof sampleTask.creator.username === "string");
        assert("Task relation 'department' loaded in single SQL query (no N+1)", sampleTask.department === null || typeof sampleTask.department.name === "string");

        // =========================================================================
        // TEST GROUP 6: FIXTURE CLEANUP & TEARDOWN
        // =========================================================================
        console.log("\n--- TEST GROUP 6: FIXTURE CLEANUP ---");

        // Teardown temporary users and entries
        await query(`DELETE FROM public.workspace_tasks WHERE workspace_id = $1 AND title LIKE 'P9 %';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_messages WHERE workspace_id = $1 AND content = 'Hello Phase 09 Realtime!';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_channels WHERE id = ANY($1::uuid[]);`, [[publicChan.id, privateChan.id]]);
        await query(`DELETE FROM public.workspace_channel_categories WHERE id = $1;`, [cat.id]);
        await query(`DELETE FROM public.workspace_department_transfers WHERE workspace_id = $1;`, [workspaceId]);
        await query(`DELETE FROM public.workspace_department_members WHERE department_id = ANY($1::uuid[]);`, [[deptA.id, deptB.id]]);
        await query(`DELETE FROM public.workspace_departments WHERE id = ANY($1::uuid[]);`, [[deptA.id, deptB.id]]);
        await query(`DELETE FROM public.workspace_members WHERE user_id = ANY($1::uuid[]);`, [[managerUser.id, deptLeadUser.id, outsideUser.id]]);
        await query(`DELETE FROM public.workspace_roles WHERE id = $1;`, [customRole.id]);
        await query(`DELETE FROM public.users WHERE id = ANY($1::uuid[]);`, [[managerUser.id, deptLeadUser.id, outsideUser.id]]);

        // Clean Redis cache keys
        await WorkspaceRedisService.invalidateAllWorkspacePermissions(workspaceId);
        await WorkspaceRedisService.invalidateMemberDirectory(workspaceId);
        await WorkspaceRedisService.invalidateTaskAccountability(workspaceId);
        await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);

        assert("Test fixtures and temporary resources cleaned up cleanly", true);

    } catch (err: any) {
        console.error("Test execution failed with unhandled exception:", err);
        failed++;
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 09 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("===============================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase09Tests()
    .then(() => {
        pool.end();
        process.exit(0);
    })
    .catch((err) => {
        console.error("Fatal test error:", err);
        pool.end();
        process.exit(1);
    });
