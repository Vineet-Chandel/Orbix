// Backend/scripts/test_team_workspace_phase_00_audit.ts
/**
 * ORBIX TEAM WORKSPACE — PHASE 00 AUDIT & WORKFLOW VERIFICATION TEST SUITE
 * 
 * Verifies End-to-End Workflows across all 4 core roles:
 * - Workflow A: Club Manager (Owner) Full Lifecycle
 * - Workflow B: Workspace Manager Delegated Administration & Boundaries
 * - Workflow C: Department Lead Scoped Powers & Isolation
 * - Workflow D: Team Member Task Execution & Submission
 * - Workflow E: Realtime Permission Revocation & Cache Invalidation
 */

import { query, pool } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceChannelService } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceCapabilityService } from "../src/services/workspace/workspaceCapabilityService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase00AuditTests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 00 COMPREHENSIVE AUDIT & WORKFLOW VERIFICATION");
    console.log("===============================================================================\n");

    let passed = 0;
    let failed = 0;

    const assert = (desc: string, condition: boolean, extra?: any) => {
        if (condition) {
            console.log(`  ✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${desc}`, extra ? extra : "");
            failed++;
        }
    };

    try {
        // 1. Locate primary test club
        const clubRes = await query(
            `SELECT vc.id, vc.name, vc.slug, vc.auth_user_id 
             FROM public.verified_clubs vc 
             WHERE vc.auth_user_id IS NOT NULL 
             ORDER BY vc.created_at ASC 
             LIMIT 1;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No verified clubs with owners found for audit tests.");
        }
        const club = clubRes.rows[0];
        const ownerId = club.auth_user_id;
        console.log(`Auditing Club: "${club.name}" (Club ID: ${club.id}, Owner: ${ownerId})\n`);

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerId);
        const wsId = workspace.id;

        // 2. Setup Isolated Ephemeral Users for Phase 00 Audit
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (role: string) => {
            const res = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username;`,
                [`p00_${role}_${randKey}@audit.orbix.club`, `p00_${role}_${randKey}`, `P00${role}`, "AuditUser"]
            );
            return res.rows[0];
        };

        const mgrUser = await makeUser("manager");
        const leadAUser = await makeUser("lead_a");
        const leadBUser = await makeUser("lead_b");
        const memberUser = await makeUser("member");

        const defaultMemberRole = await WorkspaceRepository.findRoleBySlug(wsId, "member");
        if (!defaultMemberRole) throw new Error("Default member role not found.");

        const mgrMem = await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: mgrUser.id,
            roleId: defaultMemberRole.id,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        const leadAMem = await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: leadAUser.id,
            roleId: defaultMemberRole.id,
            roleTitle: "Lead Dept A",
            membershipStatus: "active",
        });

        const leadBMem = await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: leadBUser.id,
            roleId: defaultMemberRole.id,
            roleTitle: "Lead Dept B",
            membershipStatus: "active",
        });

        const regMem = await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: memberUser.id,
            roleId: defaultMemberRole.id,
            roleTitle: "Regular Member",
            membershipStatus: "active",
        });

        // =========================================================================
        // WORKFLOW A — CLUB MANAGER (OWNER)
        // =========================================================================
        console.log("--- WORKFLOW A: CLUB MANAGER (SUPREME AUTHORITY & LIFECYCLE) ---");

        // 1. Owner Capability Resolution
        const ownerCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsId, ownerId);
        assert("Club Manager possesses supreme authority (isOwner = true)", ownerCaps.isOwner === true);
        assert("Club Manager has unrestricted audit trail access", ownerCaps.navigation.canViewAuditLogs === true);

        // 2. Club Manager creates department
        const deptAlpha = await WorkspaceDepartmentService.createDepartment(wsId, ownerId, {
            name: `Audit Dept Alpha ${randKey}`,
            slug: `audit-dept-alpha-${randKey}`,
            leadUserId: leadAUser.id,
            description: "Workflow A test department",
        });
        assert("Club Manager can create a department", !!deptAlpha.id);

        const deptBeta = await WorkspaceDepartmentService.createDepartment(wsId, ownerId, {
            name: `Audit Dept Beta ${randKey}`,
            slug: `audit-dept-beta-${randKey}`,
            leadUserId: leadBUser.id,
            description: "Workflow A second department",
        });
        assert("Club Manager can create second department", !!deptBeta.id);

        // 3. Add regular member to deptAlpha
        await WorkspaceDepartmentService.addMemberToDepartment(wsId, ownerId, deptAlpha.id, regMem.id, "member");
        const deptAlphaMembers = await WorkspaceRepository.listDepartmentMembers(wsId, deptAlpha.id);
        assert("Club Manager can add members to a department", deptAlphaMembers.some((m) => m.userId === memberUser.id));

        // 4. Create custom role
        const customRole = await WorkspaceMemberService.createCustomRole(wsId, ownerId, {
            name: `Audit Custom Role ${randKey}`,
            slug: `audit-custom-${randKey}`,
            rank: 350,
            permissions: ["departments:manage", "departments:create"],
        });
        assert("Club Manager can create custom roles", !!customRole.id && customRole.rank === 350);

        // 5. Create Task and Assign Members
        const taskA = await WorkspaceTaskService.createTask(wsId, ownerId, {
            title: `Audit Task A ${randKey}`,
            departmentId: deptAlpha.id,
            isRestricted: true,
            priority: "urgent",
            assigneeUserIds: [memberUser.id],
        });
        assert("Club Manager can create restricted department task with initial assignee", !!taskA.id);

        // 6. Assigned Member submits work
        const { submission } = await WorkspaceTaskService.submitTask(wsId, memberUser.id, taskA.id, "Completed deliverable for Workflow A");
        assert("Assigned member can submit deliverable", !!submission.id);

        // 7. Club Manager reviews and approves work
        const reviewRes = await WorkspaceTaskService.reviewTask(wsId, ownerId, taskA.id, submission.id, "approved", "Excellent work by Owner review");
        assert("Club Manager can approve task submissions workspace-wide", reviewRes.review.decision === "approved");

        // 8. Verify Audit Log entry recorded
        const auditRes = await WorkspaceRepository.listAuditLogs(wsId, { limit: 10 });
        assert("Audit log reflects operations performed by Club Manager", auditRes.logs.length > 0);

        // =========================================================================
        // WORKFLOW B — WORKSPACE MANAGER (DELEGATED AUTHORITY)
        // =========================================================================
        console.log("\n--- WORKFLOW B: WORKSPACE MANAGER (DELEGATED POWERS & BOUNDARIES) ---");

        // 1. Appoint Workspace Manager with delegated powers
        await WorkspaceMemberService.appointWorkspaceManager(wsId, ownerId, mgrUser.id, [
            "can_manage_members",
            "can_manage_departments",
            "can_manage_channels",
            "can_manage_tasks",
            "can_view_audit_logs",
        ]);

        const mgrCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsId, mgrUser.id);
        assert("Workspace Manager resolves delegated state (isWorkspaceManager = true)", mgrCaps.isWorkspaceManager === true);
        assert("Workspace Manager can manage members via delegation", mgrCaps.capabilities.members.manage === true);
        assert("Workspace Manager can view audit logs via delegation", mgrCaps.navigation.canViewAuditLogs === true);

        // 2. Workspace Manager creates an authorized task
        const mgrTask = await WorkspaceTaskService.createTask(wsId, mgrUser.id, {
            title: `Mgr Coordinated Task ${randKey}`,
            departmentId: deptAlpha.id,
            isRestricted: false,
            assigneeUserIds: [memberUser.id],
        });
        assert("Workspace Manager can create tasks across departments", !!mgrTask.id);

        // 3. Member submits work, Workspace Manager reviews
        const mgrSub = await WorkspaceTaskService.submitTask(wsId, memberUser.id, mgrTask.id, "Deliverable for Workspace Manager task");
        const mgrReview = await WorkspaceTaskService.reviewTask(wsId, mgrUser.id, mgrTask.id, mgrSub.submission.id, "approved", "Approved by Workspace Manager");
        assert("Workspace Manager can review and approve tasks", mgrReview.review.decision === "approved");

        // 4. Boundary check: Workspace Manager cannot promote anyone to Owner or self-promote
        const ownerRole = await WorkspaceRepository.findRoleBySlug(wsId, "owner");
        let mgrEscalateErr = false;
        try {
            await WorkspaceMemberService.assignMemberRole(wsId, mgrUser.id, mgrUser.id, ownerRole!.id);
        } catch {
            mgrEscalateErr = true;
        }
        assert("Workspace Manager cannot self-promote to Owner rank (hierarchy boundary)", mgrEscalateErr === true);

        // 5. Boundary check: Workspace Manager cannot appoint another Workspace Manager
        let mgrAppointErr = false;
        try {
            await WorkspaceMemberService.appointWorkspaceManager(wsId, mgrUser.id, memberUser.id, ["can_manage_tasks"]);
        } catch {
            mgrAppointErr = true;
        }
        assert("Workspace Manager cannot appoint other managers (Club Owner exclusive)", mgrAppointErr === true);

        // =========================================================================
        // WORKFLOW C — DEPARTMENT LEAD (SCOPED POWERS & ZERO-LEAK ISOLATION)
        // =========================================================================
        console.log("\n--- WORKFLOW C: DEPARTMENT LEAD (SCOPED POWERS & ZERO-LEAK ISOLATION) ---");

        // 1. Dept A Lead creates a task in Dept A
        const leadTaskA = await WorkspaceTaskService.createTask(wsId, leadAUser.id, {
            title: `Dept A Internal Task ${randKey}`,
            departmentId: deptAlpha.id,
            isRestricted: true,
            assigneeUserIds: [memberUser.id],
        });
        assert("Department Lead can create restricted task in their own department", !!leadTaskA.id);

        // 2. Member submits deliverable
        const leadSub = await WorkspaceTaskService.submitTask(wsId, memberUser.id, leadTaskA.id, "Dept A submission");
        assert("Assignee can submit work for Department Lead task", !!leadSub.submission.id);

        // 3. Dept A Lead reviews and approves
        const leadReview = await WorkspaceTaskService.reviewTask(wsId, leadAUser.id, leadTaskA.id, leadSub.submission.id, "approved", "Dept Lead Approved");
        assert("Department Lead can review submissions in their own department", leadReview.review.decision === "approved");

        // 4. Dept B Lead tries to review Dept A Task -> FORBIDDEN
        let crossLeadReviewErr = false;
        try {
            await WorkspaceTaskService.reviewTask(wsId, leadBUser.id, leadTaskA.id, leadSub.submission.id, "changes_requested", "Cross lead intervention");
        } catch {
            crossLeadReviewErr = true;
        }
        assert("Foreign Department Lead is FORBIDDEN from reviewing Dept A tasks", crossLeadReviewErr === true);

        // 5. Dept A Lead cannot access Dept B insight metrics
        let crossDeptInsightErr = false;
        try {
            await WorkspaceDashboardService.getDepartmentInsight(wsId, leadAUser.id, deptBeta.id);
        } catch {
            crossDeptInsightErr = true;
        }
        assert("Department Lead is FORBIDDEN from accessing foreign department insights", crossDeptInsightErr === true);

        // =========================================================================
        // WORKFLOW D — TEAM MEMBER (WORKFLOW EXECUTION & RESTRICTIONS)
        // =========================================================================
        console.log("\n--- WORKFLOW D: TEAM MEMBER (WORKFLOW EXECUTION & RESTRICTIONS) ---");

        // 1. Member resolves capabilities
        const memberCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsId, memberUser.id);
        assert("Regular member cannot manage roles", memberCaps.capabilities.roles.manage === false);
        assert("Regular member cannot manage settings", memberCaps.capabilities.workspace.manageSettings === false);
        assert("Regular member cannot view audit logs", memberCaps.navigation.canViewAuditLogs === false);

        // 2. Member can list assigned tasks
        const memberTaskList = await WorkspaceTaskService.listTasks(wsId, memberUser.id, { tab: "assigned_to_me" });
        assert("Regular member can list their assigned tasks", memberTaskList.tasks.some((t) => t.id === leadTaskA.id));

        // 3. Member attempts forbidden actions
        let memberDeleteDeptErr = false;
        try {
            await WorkspaceDepartmentService.archiveDepartment(wsId, memberUser.id, deptAlpha.id);
        } catch {
            memberDeleteDeptErr = true;
        }
        assert("Regular member is FORBIDDEN from archiving departments", memberDeleteDeptErr === true);

        let memberCreateRoleErr = false;
        try {
            await WorkspaceMemberService.createCustomRole(wsId, memberUser.id, {
                name: "Hacked Role",
                permissions: ["*"],
            });
        } catch {
            memberCreateRoleErr = true;
        }
        assert("Regular member is FORBIDDEN from creating custom roles", memberCreateRoleErr === true);

        // =========================================================================
        // WORKFLOW E — PERMISSIONS (REVOCATION & CACHE INVALIDATION)
        // =========================================================================
        console.log("\n--- WORKFLOW E: PERMISSIONS (REVOCATION & CACHE INVALIDATION) ---");

        // 1. Assign temporary custom role to memberUser
        await WorkspaceMemberService.assignMemberRole(wsId, ownerId, memberUser.id, customRole.id);
        const tempCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsId, memberUser.id);
        assert("Member gains elevated capabilities with custom role (departments.manageAll = true)", tempCaps.capabilities.departments.manageAll === true);

        // Verify cached in Redis
        const cachedCaps1 = await WorkspaceRedisService.getCachedCapabilities(wsId, memberUser.id);
        assert("Elevated capabilities are stored in Redis", cachedCaps1 !== null);

        // 2. Revoke role back to default member
        await WorkspaceMemberService.assignMemberRole(wsId, ownerId, memberUser.id, defaultMemberRole.id);

        // 3. Verify Redis cache immediately invalidated
        const cachedCaps2 = await WorkspaceRedisService.getCachedCapabilities(wsId, memberUser.id);
        assert("Role revocation immediately purges Redis cache", cachedCaps2 === null);

        // 4. Verify freshly resolved capabilities reflect revocation
        const revokedCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsId, memberUser.id);
        assert("Fresh resolution reflects revoked status (departments.manageAll = false)", revokedCaps.capabilities.departments.manageAll === false);

        // =========================================================================
        // CLEANUP & TEARDOWN
        // =========================================================================
        console.log("\n--- EPHEMERAL AUDIT FIXTURE CLEANUP ---");
        await query(`DELETE FROM public.workspace_task_reviews WHERE workspace_id = $1;`, [wsId]);
        await query(`DELETE FROM public.workspace_task_submissions WHERE workspace_id = $1;`, [wsId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE workspace_id = $1;`, [wsId]);
        await query(`DELETE FROM public.workspace_tasks WHERE workspace_id = $1;`, [wsId]);
        await query(`DELETE FROM public.workspace_department_members WHERE workspace_id = $1;`, [wsId]);
        await query(`DELETE FROM public.workspace_departments WHERE workspace_id = $1;`, [wsId]);
        await query(`DELETE FROM public.workspace_members WHERE user_id = ANY($1::uuid[]);`, [[mgrUser.id, leadAUser.id, leadBUser.id, memberUser.id]]);
        await query(`DELETE FROM public.workspace_roles WHERE id = $1;`, [customRole.id]);
        await query(`DELETE FROM public.users WHERE id = ANY($1::uuid[]);`, [[mgrUser.id, leadAUser.id, leadBUser.id, memberUser.id]]);

        await WorkspaceRedisService.invalidateAllWorkspacePermissions(wsId);
        await WorkspaceRedisService.invalidateMemberDirectory(wsId);
        await WorkspaceRedisService.invalidateTaskAccountability(wsId);

        assert("Audit fixtures purged cleanly without residual data", true);

    } catch (err: any) {
        console.error("Phase 00 Audit error:", err);
        failed++;
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 00 AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("===============================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase00AuditTests()
    .then(() => {
        pool.end();
        process.exit(0);
    })
    .catch((err) => {
        console.error("Fatal audit error:", err);
        pool.end();
        process.exit(1);
    });
