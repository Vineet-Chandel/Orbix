// Backend/scripts/test_workspace_history.ts
import { randomUUID } from "node:crypto";
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceChannelService } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";

async function runWorkspaceHistoryTests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — UNIFIED WORKSPACE HISTORY TEST SUITE");
    console.log("===============================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(desc: string, condition: boolean) {
        if (condition) {
            console.log(`  PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  FAIL: ${desc}`);
            failed++;
        }
    }

    const randKey = randomUUID().slice(0, 8);
    const createdUserIds: string[] = [];
    const createdDeptIds: string[] = [];
    const createdTaskIds: string[] = [];
    const createdChannelIds: string[] = [];
    const createdRoleIds: string[] = [];
    const createdActivityIds: string[] = [];
    const createdAuditIds: string[] = [];
    let workspaceId = "";

    try {
        // 1. Target Club + Owner
        const clubRes = await query(
            `SELECT vc.id, vc.name, vc.auth_user_id
             FROM public.verified_clubs vc
             WHERE vc.auth_user_id IS NOT NULL
             LIMIT 1;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No verified club with auth_user_id found in DB.");
        }
        const club = clubRes.rows[0];
        const ownerUserId = club.auth_user_id as string;
        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerUserId);
        workspaceId = workspace.id;

        const defaultMemberRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "member");
        if (!defaultMemberRole) throw new Error("Default member role not found");

        const makeUser = async (tag: string) => {
            const res = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [`wh_${tag}_${randKey}@test.orbix.club`, `wh_${tag}_${randKey}`, `WH_${tag}`, "Tester"]
            );
            createdUserIds.push(res.rows[0].id);
            return res.rows[0];
        };

        const deptAUser = await makeUser("depta");
        const deptBUser = await makeUser("deptb");
        const auditViewerUser = await makeUser("auditor");
        const outsiderUser = await makeUser("outsider");

        // Custom Role with audit:view permission
        const auditorRole = await WorkspaceRepository.createRole(null, {
            workspaceId,
            name: `Auditor ${randKey}`,
            slug: `auditor-${randKey}`,
            description: "Test audit viewer role",
            rank: 40,
            permissions: ["tasks:view", "audit:view"],
        });
        createdRoleIds.push(auditorRole.id);

        // Departments (created before assigning member departmentId)
        const deptA = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Hist Dept A ${randKey}`,
            slug: `hist-dept-a-${randKey}`,
            leadUserId: deptAUser.id,
        });
        createdDeptIds.push(deptA.id);

        const deptB = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Hist Dept B ${randKey}`,
            slug: `hist-dept-b-${randKey}`,
            leadUserId: deptBUser.id,
        });
        createdDeptIds.push(deptB.id);

        // Members
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptAUser.id,
            roleId: defaultMemberRole.id,
            departmentId: deptA.id,
            membershipStatus: "active",
        });
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptBUser.id,
            roleId: defaultMemberRole.id,
            departmentId: deptB.id,
            membershipStatus: "active",
        });
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: auditViewerUser.id,
            roleId: auditorRole.id,
            membershipStatus: "active",
        });
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: outsiderUser.id,
            roleId: defaultMemberRole.id,
            membershipStatus: "active",
        });

        console.log("--- GROUP 1: CLUB LOGIN OVERSIGHT, SANITIZATION & EXPORT ---");
        // Seed correlated & sensitive fixtures
        const restrictedEvent = await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: deptB.id,
            actorId: deptBUser.id,
            eventType: `department:secret_${randKey}`,
            resourceType: "department",
            resourceId: deptB.id,
            title: `Secret plan ${randKey}`,
            isRestricted: true,
            metadata: { note: `DeptB restricted event ${randKey}` },
        });
        createdActivityIds.push(restrictedEvent.id);

        const publicEvent = await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            actorId: ownerUserId,
            eventType: `workspace:announcement_${randKey}`,
            resourceType: "workspace",
            resourceId: workspaceId,
            title: `Public announcement ${randKey}`,
            isRestricted: false,
            metadata: { note: `Public announcement ${randKey}` },
        });
        createdActivityIds.push(publicEvent.id);

        const auditFixture = await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: ownerUserId,
            action: `security_policy_${randKey}`,
            targetType: "workspace",
            targetId: workspaceId,
            details: {
                policy: `=SUM(1,1) strict-${randKey}`,
                secretToken: "super-secret-value-must-redact",
                passwordHash: "hash123",
            },
            ipAddress: "203.0.113.42",
            userAgent: "OrbixTestAgent/1.0",
        });
        createdAuditIds.push(auditFixture.id);

        const clubHistory = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            { search: randKey, limit: 50 }
        );

        assert(
            "Club login sees combined activity + audit + restricted events",
            clubHistory.items.some((i) => i.id === restrictedEvent.id) &&
                clubHistory.items.some((i) => i.id === publicEvent.id) &&
                clubHistory.items.some((i) => i.id === auditFixture.id) &&
                clubHistory.permissions.scope === "global" &&
                clubHistory.permissions.canViewAudit === true &&
                clubHistory.permissions.canExport === true
        );

        const listAuditRow = clubHistory.items.find((i) => i.id === auditFixture.id);
        assert(
            "Timeline list response omits raw auditDetails IP/UA/JSON payload until Inspect",
            Boolean(listAuditRow) && listAuditRow?.permissions.canInspect === true && !listAuditRow?.auditDetails
        );

        const inspectedAudit = await WorkspaceDashboardService.inspectHistoryItem(
            workspaceId,
            ownerUserId,
            auditFixture.id,
            "audit"
        );
        assert(
            "Club inspect returns IP/UA and redacts secret keys (secretToken/passwordHash)",
            inspectedAudit.auditDetails?.ipAddress === "203.0.113.42" &&
                inspectedAudit.auditDetails?.userAgent === "OrbixTestAgent/1.0" &&
                inspectedAudit.auditDetails?.details?.secretToken === "[REDACTED]" &&
                inspectedAudit.auditDetails?.details?.passwordHash === "[REDACTED]"
        );

        // CSV Export & Formula Neutralization
        const csvChunks: string[] = [];
        await WorkspaceDashboardService.exportWorkspaceHistory(
            workspaceId,
            ownerUserId,
            "csv",
            { search: randKey },
            (chunk) => csvChunks.push(chunk)
        );
        const csvOutput = csvChunks.join("");
        assert(
            "CSV export includes records, headers, and neutralizes formula characters safely",
            csvOutput.includes("Timestamp,Source,Sources,Category,EventType") &&
                csvOutput.includes(`security_policy_${randKey}`) &&
                !csvOutput.includes(",=SUM(1,1)")
        );

        console.log("\n--- GROUP 2: CURSOR PAGINATION STABILITY ON IDENTICAL TIMESTAMPS ---");
        const tiedTs = new Date("2026-01-15T12:00:00.123456Z");
        const tiedTag = `tied_${randKey}`;
        const tiedAct1 = await query(
            `INSERT INTO public.workspace_activity_feed (workspace_id, actor_id, event_type, resource_type, resource_id, title, metadata, created_at)
             VALUES ($1, $2, $3, 'task', $4, $5, $6, $7) RETURNING id;`,
            [workspaceId, ownerUserId, `task:created`, randomUUID(), `Tied Task 1 ${tiedTag}`, JSON.stringify({ tag: tiedTag, n: 1 }), tiedTs]
        );
        const tiedAct2 = await query(
            `INSERT INTO public.workspace_activity_feed (workspace_id, actor_id, event_type, resource_type, resource_id, title, metadata, created_at)
             VALUES ($1, $2, $3, 'task', $4, $5, $6, $7) RETURNING id;`,
            [workspaceId, ownerUserId, `task:updated`, randomUUID(), `Tied Task 2 ${tiedTag}`, JSON.stringify({ tag: tiedTag, n: 2 }), tiedTs]
        );
        const tiedAud1 = await query(
            `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, action, target_type, target_id, details, created_at)
             VALUES ($1, $2, $3, 'role', $4, $5, $6) RETURNING id;`,
            [workspaceId, ownerUserId, `role_${tiedTag}_1`, randomUUID(), JSON.stringify({ tag: tiedTag }), tiedTs]
        );
        const tiedAud2 = await query(
            `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, action, target_type, target_id, details, created_at)
             VALUES ($1, $2, $3, 'role', $4, $5, $6) RETURNING id;`,
            [workspaceId, ownerUserId, `role_${tiedTag}_2`, randomUUID(), JSON.stringify({ tag: tiedTag }), tiedTs]
        );
        createdActivityIds.push(tiedAct1.rows[0].id, tiedAct2.rows[0].id);
        createdAuditIds.push(tiedAud1.rows[0].id, tiedAud2.rows[0].id);

        const page1 = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            { search: tiedTag, limit: 2 }
        );
        const page2 = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            {
                search: tiedTag,
                limit: 2,
                ...(page1.nextCursor ? { cursor: page1.nextCursor } : {}),
            }
        );
        const collectedIds = [...page1.items, ...page2.items].map((i) => i.id);
        const uniqueCollected = new Set(collectedIds);
        assert(
            "Composite keyset cursor paginates identical timestamps with zero skips or duplicates",
            page1.items.length === 2 &&
                page2.items.length === 2 &&
                uniqueCollected.size === 4 &&
                page2.hasMore === false
        );

        console.log("\n--- GROUP 3: PERSONAL LOGIN SECURITY & IDOR ENFORCEMENT ---");
        const deptAHistory = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            deptAUser.id,
            { search: randKey, limit: 50 }
        );
        assert(
            "Ordinary personal member sees public activity ONLY — zero audit rows, zero Dept B restricted rows",
            deptAHistory.items.some((i) => i.id === publicEvent.id) &&
                !deptAHistory.items.some((i) => i.id === restrictedEvent.id) &&
                !deptAHistory.items.some((i) => i.source === "audit") &&
                deptAHistory.permissions.canViewAudit === false &&
                deptAHistory.permissions.canExport === false
        );

        // Unauthorized recordType=audit
        let blockedAuditFilter = false;
        try {
            await WorkspaceDashboardService.getWorkspaceHistory(
                workspaceId,
                deptAUser.id,
                { recordType: "audit" }
            );
        } catch (err: any) {
            blockedAuditFilter = err?.statusCode === 403 || String(err?.message).includes("Forbidden");
        }
        assert("Unauthorized member requesting recordType='audit' gets 403 Forbidden", blockedAuditFilter);

        // Unauthorized deptB lookup
        let blockedCrossDept = false;
        try {
            await WorkspaceDashboardService.getWorkspaceHistory(
                workspaceId,
                deptAUser.id,
                { departmentId: deptB.id }
            );
        } catch (err: any) {
            blockedCrossDept = err?.statusCode === 403 || String(err?.message).includes("Forbidden");
        }
        assert("Unauthorized member querying Dept B history gets 403 Forbidden", blockedCrossDept);

        // Unauthorized audit inspect IDOR
        let blockedAuditInspect = false;
        try {
            await WorkspaceDashboardService.inspectHistoryItem(
                workspaceId,
                deptAUser.id,
                auditFixture.id,
                "audit"
            );
        } catch (err: any) {
            blockedAuditInspect = err?.statusCode === 403 || String(err?.message).includes("Forbidden");
        }
        assert("Unauthorized member inspecting an audit record ID gets 403 Forbidden", blockedAuditInspect);

        // Unauthorized restricted activity inspect IDOR
        let blockedRestrictedInspect = false;
        try {
            await WorkspaceDashboardService.inspectHistoryItem(
                workspaceId,
                deptAUser.id,
                restrictedEvent.id,
                "activity"
            );
        } catch (err: any) {
            blockedRestrictedInspect =
                err?.statusCode === 403 || String(err?.message).includes("Forbidden");
        }
        assert("Unauthorized member inspecting Dept B restricted event gets 403 Forbidden", blockedRestrictedInspect);

        // Unauthorized export
        let blockedExport = false;
        try {
            await WorkspaceDashboardService.exportWorkspaceHistory(
                workspaceId,
                deptAUser.id,
                "json",
                {},
                () => {}
            );
        } catch (err: any) {
            blockedExport = err?.statusCode === 403 || String(err?.message).includes("Forbidden");
        }
        assert("Unauthorized member calling exportWorkspaceHistory gets 403 Forbidden", blockedExport);

        // Personal scope spoofed actorId
        const deptAPersonalOwn = await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: deptA.id,
            actorId: deptAUser.id,
            eventType: `task:comment`,
            resourceType: "task",
            resourceId: randomUUID(),
            title: `Personal comment ${randKey}`,
            metadata: { tag: `own_${randKey}` },
        });
        createdActivityIds.push(deptAPersonalOwn.id);
        const personalScopeRes = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            deptAUser.id,
            { scope: "personal", actorId: deptBUser.id }
        );
        assert(
            "scope='personal' locks strictly to caller's userId even if another actorId is supplied",
            personalScopeRes.items.length > 0 &&
                personalScopeRes.items.every((i) => i.actor.id === deptAUser.id)
        );

        console.log("\n--- GROUP 4: PERSONAL USER WITH EXPLICIT AUDIT PERMISSION ---");
        const auditorHistory = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            auditViewerUser.id,
            { recordType: "audit", search: randKey }
        );
        assert(
            "Personal user with audit:view receives audit history and export access",
            auditorHistory.permissions.canViewAudit === true &&
                auditorHistory.permissions.canExport === true &&
                auditorHistory.items.some((i) => i.id === auditFixture.id)
        );

        console.log("\n--- GROUP 5: REAL EVENT PRODUCERS, DEDUP, CATEGORY PREFIX & TARGET FILTER ---");
        // Produce real Task events
        const createdTask = await WorkspaceTaskService.createTask(workspaceId, ownerUserId, {
            title: `History Producer Task ${randKey}`,
            departmentId: deptA.id,
            priority: "high",
        });
        createdTaskIds.push(createdTask.id);
        await WorkspaceTaskService.setTaskAssignees(
            workspaceId,
            ownerUserId,
            createdTask.id,
            [deptAUser.id]
        );

        await WorkspaceTaskService.addComment(
            workspaceId,
            deptAUser.id,
            createdTask.id,
            `Test comment ${randKey}`
        );

        // Produce correlated Department + Channel events
        const createdDept = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            ownerUserId,
            { name: `Producer Dept ${randKey}` },
            { ipAddress: "198.51.100.10", userAgent: "ProducerTest/1.0" }
        );
        createdDeptIds.push(createdDept.id);

        const createdChan = await WorkspaceChannelService.createChannel(
            workspaceId,
            ownerUserId,
            { name: `prod-chan-${randKey}`, channelType: "text" },
            { ipAddress: "198.51.100.11", userAgent: "ProducerTest/1.0" }
        );
        createdChannelIds.push(createdChan.id);

        // Failed recognition action (invalid category) does not emit partial activity rows
        let rejectedAward = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(workspaceId, ownerUserId, {
                recipientUserId: deptAUser.id,
                categorySlugOrId: "non-existent-category-" + randKey,
                amount: 5,
                reason: `Should fail award ${randKey}`,
            });
        } catch {
            rejectedAward = true;
        }
        const failedAwardActivityRes = await query(
            `SELECT COUNT(*)::int AS cnt FROM public.workspace_activity_feed
             WHERE workspace_id = $1 AND event_type LIKE 'recognition%' AND metadata::text LIKE $2;`,
            [workspaceId, `%${randKey}%`]
        );
        assert(
            "Failed recognition award emits zero activity events",
            rejectedAward && failedAwardActivityRes.rows[0].cnt === 0
        );

        // Verify Category prefix filter (`category: "task"` matches `task:created`, `task:comment`, etc.)
        const taskCatRes = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            { category: "task", limit: 30 }
        );
        assert(
            "Category prefix filter 'task' matches colon-delimited task:* activity events",
            taskCatRes.items.some(
                (i) => i.target?.id === createdTask.id && i.eventType === "task:created"
            ) &&
                taskCatRes.items.some(
                    (i) => i.target?.id === createdTask.id && i.eventType === "task:assigned"
                ) &&
                taskCatRes.items.every((i) => !i.eventType.startsWith("department"))
        );

        // Verify correlated dedup in `all` mode: department_created + department:created share correlation_id -> shown once in `all`
        const deptAllRes = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            { recordType: "all", category: "department", limit: 30 }
        );
        const matchesForCreatedDept = deptAllRes.items.filter(
            (i) => i.target?.id === createdDept.id && i.eventType.includes("created")
        );
        const deptAuditOnly = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            { recordType: "audit", category: "department", limit: 30 }
        );
        const deptActOnly = await WorkspaceDashboardService.getWorkspaceHistory(
            workspaceId,
            ownerUserId,
            { recordType: "activity", category: "department", limit: 30 }
        );
        assert(
            "Correlated audit+activity event deduplicates in 'all' mode while remaining queryable individually",
            deptAuditOnly.items.some((i) => i.target?.id === createdDept.id && i.source === "audit") &&
                deptActOnly.items.some((i) => i.target?.id === createdDept.id && i.source === "activity") &&
                matchesForCreatedDept.length === 1
        );

        // Verify partial audit action match & targetType normalization
        const partialAudit = await WorkspaceRepository.listAuditLogs(workspaceId, {
            action: "policy",
            targetType: "workspace_member",
        });
        const partialActionOnly = await WorkspaceRepository.listAuditLogs(workspaceId, {
            action: `policy_${randKey}`,
        });
        assert(
            "Legacy listAuditLogs action filter supports partial ILIKE matching",
            partialActionOnly.logs.some((l) => l.id === auditFixture.id) &&
                Array.isArray(partialAudit.logs)
        );

        // Failed / rejected task creation (non-member actor) emits zero activity events
        const nonMemberUser = await makeUser("ext");
        const beforeCountRes = await query(
            `SELECT COUNT(*)::int AS cnt FROM public.workspace_activity_feed WHERE workspace_id = $1 AND actor_id = $2;`,
            [workspaceId, nonMemberUser.id]
        );
        let rejectedCreate = false;
        try {
            await WorkspaceTaskService.createTask(workspaceId, nonMemberUser.id, {
                title: `Should Fail ${randKey}`,
            });
        } catch {
            rejectedCreate = true;
        }
        const afterCountRes = await query(
            `SELECT COUNT(*)::int AS cnt FROM public.workspace_activity_feed WHERE workspace_id = $1 AND actor_id = $2;`,
            [workspaceId, nonMemberUser.id]
        );
        assert(
            "Rejected action emits zero partial activity events",
            rejectedCreate && beforeCountRes.rows[0].cnt === afterCountRes.rows[0].cnt
        );
    } catch (err: any) {
        console.error("Unhandled test error:", err);
        failed++;
    } finally {
        // Cleanup only rows created by this test script
        try {
            if (createdActivityIds.length > 0) {
                await query(`DELETE FROM public.workspace_activity_feed WHERE id = ANY($1::uuid[]);`, [
                    createdActivityIds,
                ]);
            }
            if (createdAuditIds.length > 0) {
                await query(`DELETE FROM public.workspace_audit_logs WHERE id = ANY($1::uuid[]);`, [
                    createdAuditIds,
                ]);
            }
            if (workspaceId && createdUserIds.length > 0) {
                await query(
                    `DELETE FROM public.workspace_activity_feed WHERE workspace_id = $1 AND actor_id = ANY($2::uuid[]);`,
                    [workspaceId, createdUserIds]
                );
                await query(
                    `DELETE FROM public.workspace_notifications WHERE workspace_id = $1 AND recipient_id = ANY($2::uuid[]);`,
                    [workspaceId, createdUserIds]
                );
            }
            if (createdTaskIds.length > 0) {
                await query(
                    `DELETE FROM public.workspace_activity_feed WHERE resource_type = 'task' AND resource_id = ANY($1::text[]);`,
                    [createdTaskIds]
                );
                await query(
                    `DELETE FROM public.workspace_audit_logs WHERE target_type = 'task' AND target_id = ANY($1::uuid[]);`,
                    [createdTaskIds]
                );
                await query(`DELETE FROM public.workspace_tasks WHERE id = ANY($1::uuid[]);`, [
                    createdTaskIds,
                ]);
            }
            if (createdChannelIds.length > 0) {
                await query(
                    `DELETE FROM public.workspace_activity_feed WHERE resource_type = 'channel' AND resource_id = ANY($1::text[]);`,
                    [createdChannelIds]
                );
                await query(
                    `DELETE FROM public.workspace_audit_logs WHERE target_type = 'channel' AND target_id = ANY($1::uuid[]);`,
                    [createdChannelIds]
                );
                await query(`DELETE FROM public.workspace_channels WHERE id = ANY($1::uuid[]);`, [
                    createdChannelIds,
                ]);
            }
            if (createdDeptIds.length > 0) {
                await query(
                    `DELETE FROM public.workspace_activity_feed WHERE resource_type = 'department' AND resource_id = ANY($1::text[]);`,
                    [createdDeptIds]
                );
                await query(
                    `DELETE FROM public.workspace_audit_logs WHERE target_type = 'department' AND target_id = ANY($1::uuid[]);`,
                    [createdDeptIds]
                );
                await query(
                    `DELETE FROM public.workspace_departments d
                     WHERE d.id = ANY($1::uuid[])
                       AND NOT EXISTS (
                           SELECT 1 FROM public.workspace_recognition_ledger l WHERE l.department_id = d.id
                       );`,
                    [createdDeptIds]
                );
            }
            if (workspaceId) {
                await query(
                    `DELETE FROM public.workspace_activity_feed WHERE workspace_id = $1 AND metadata::text LIKE $2;`,
                    [workspaceId, `%${randKey}%`]
                );
                await query(
                    `DELETE FROM public.workspace_audit_logs WHERE workspace_id = $1 AND details::text LIKE $2;`,
                    [workspaceId, `%${randKey}%`]
                );
            }
            // Remove test tasks/members and users from current and any prior test runs (unless referenced by immutable ledger)
            await query(
                `DELETE FROM public.workspace_tasks
                 WHERE creator_id IN (SELECT id FROM public.users WHERE email LIKE 'wh_%@test.orbix.club');`
            );
            await query(
                `DELETE FROM public.workspace_members
                 WHERE user_id IN (SELECT id FROM public.users WHERE email LIKE 'wh_%@test.orbix.club');`
            );
            if (createdRoleIds.length > 0) {
                await query(`DELETE FROM public.workspace_roles WHERE id = ANY($1::uuid[]);`, [
                    createdRoleIds,
                ]);
            }
            await query(
                `DELETE FROM public.users u
                 WHERE u.email LIKE 'wh_%@test.orbix.club'
                   AND NOT EXISTS (
                       SELECT 1 FROM public.workspace_recognition_ledger l
                       WHERE l.recipient_id = u.id OR l.issuer_id = u.id
                   );`
            );
        } catch (cleanupErr) {
            console.error("Cleanup warning:", cleanupErr);
        }

        await pool.end();
        console.log("\n===============================================================================");
        console.log(`WORKSPACE HISTORY TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log("===============================================================================");
        process.exit(failed > 0 ? 1 : 0);
    }
}

runWorkspaceHistoryTests();
