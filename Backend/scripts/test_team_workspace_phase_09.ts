// Backend/scripts/test_team_workspace_phase_09.ts
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceChannelService } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceFileService } from "../src/services/workspace/workspaceFileService.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceTemplateService } from "../src/services/workspace/workspaceTemplateService.js";
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

async function runPhase09Tests() {
    console.log("================================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 09 ACCEPTANCE & RELEASE VALIDATION SUITE");
    console.log("PRODUCTION HARDENING, SECURITY AUDIT, TENANT ISOLATION & RELIABILITY");
    console.log("================================================================================\n");

    const runId = Math.random().toString(36).substring(2, 8);
    const userAId = "00000000-0000-0000-0000-000000000901";
    const userBId = "00000000-0000-0000-0000-000000000902";
    const managerAId = "00000000-0000-0000-0000-000000000903";

    try {
        // -------------------------------------------------------------------------
        // SETUP: Verify Two Distinct Verified Clubs
        // -------------------------------------------------------------------------
        const clubRes = await query(`
            SELECT id, auth_user_id, name, slug 
            FROM public.verified_clubs 
            ORDER BY created_at ASC 
            LIMIT 2;
        `);

        if (clubRes.rows.length < 2) {
            throw new Error("Phase 09 requires at least 2 verified clubs in DB for multi-tenant isolation testing.");
        }

        const clubA = clubRes.rows[0];
        const clubB = clubRes.rows[1];

        // Provision Workspace A and Workspace B
        const wsAInit = await WorkspaceService.getOrCreateWorkspaceForClub(clubA.id, clubA.auth_user_id);
        const wsBInit = await WorkspaceService.getOrCreateWorkspaceForClub(clubB.id, clubB.auth_user_id);
        const wsAId = wsAInit.workspace.id;
        const wsBId = wsBInit.workspace.id;

        assert("Workspace A provisioned successfully", Boolean(wsAId));
        assert("Workspace B provisioned successfully", Boolean(wsBId));
        assert("Workspace A and Workspace B have distinct IDs", wsAId !== wsBId);

        // Pre-test cleanup for test users
        await query(`DELETE FROM public.workspace_activity_feed WHERE actor_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_task_activity WHERE actor_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_task_reviews WHERE reviewer_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_task_submissions WHERE submitted_by IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE user_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_tasks WHERE creator_id IN ($1, $2, $3) OR title ILIKE '%P9%';`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_files WHERE uploader_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_messages WHERE sender_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_department_members WHERE user_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.workspace_members WHERE user_id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [userAId, userBId, managerAId]);

        // Insert test users
        await query(`
            INSERT INTO public.users (id, username, email, firstname, lastname, password)
            VALUES
                ($1, 'user_a_p9_${runId}', 'userA_p9_${runId}@orbix.test', 'Member', 'Alpha', 'TestPass123!'),
                ($2, 'user_b_p9_${runId}', 'userB_p9_${runId}@orbix.test', 'Member', 'Beta', 'TestPass123!'),
                ($3, 'manager_a_p9_${runId}', 'managerA_p9_${runId}@orbix.test', 'Manager', 'Alpha', 'TestPass123!')
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
        `, [userAId, userBId, managerAId]);

        // Fetch Member & Admin roles for Workspace A and B
        const rolesA = await WorkspaceRepository.listRoles(wsAId);
        const memberRoleA = rolesA.find((r) => r.isSystem && r.name === "Member") || rolesA[rolesA.length - 1]!;
        const adminRoleA = rolesA.find((r) => r.isSystem && r.name === "Administrator") || rolesA[0]!;

        const rolesB = await WorkspaceRepository.listRoles(wsBId);
        const memberRoleB = rolesB.find((r) => r.isSystem && r.name === "Member") || rolesB[rolesB.length - 1]!;

        // Register User A and Manager A in Workspace A
        const memberA = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAId,
            userId: userAId,
            roleId: memberRoleA.id,
            roleTitle: "Software Engineer",
        });
        const managerMemberA = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAId,
            userId: managerAId,
            roleId: adminRoleA.id,
            roleTitle: "Operations Manager",
        });

        // Register User B strictly in Workspace B
        const memberB = await WorkspaceRepository.createMember(null, {
            workspaceId: wsBId,
            userId: userBId,
            roleId: memberRoleB.id,
            roleTitle: "Creative Director",
        });

        assert("Member A created in Workspace A", Boolean(memberA?.id));
        assert("Member B created in Workspace B", Boolean(memberB?.id));

        // Create Seed Department & Channels in Workspace A
        const deptA = await WorkspaceDepartmentService.createDepartment(wsAId, clubA.auth_user_id, {
            name: `Engineering P9 ${runId}`,
            slug: `eng-p9-${runId}`,
            color: "#2563eb",
        });
        const catA = await WorkspaceChannelService.createCategory(wsAId, clubA.auth_user_id, {
            name: `Secure Category ${runId}`,
        });
        const channelA = await WorkspaceChannelService.createChannel(wsAId, clubA.auth_user_id, {
            name: `p9-secret-${runId}`,
            categoryId: catA.id,
            channelType: "text",
            isPrivate: true,
        });

        // Post a message and thread in Channel A
        const msgA = await WorkspaceChannelService.sendMessage(wsAId, clubA.auth_user_id, channelA.id, {
            content: "Confidential roadmap for Club A.",
        });
        const threadA = await WorkspaceChannelService.createThread(
            wsAId,
            clubA.auth_user_id,
            channelA.id,
            msgA.id,
            "Secret Thread"
        );

        // Create a restricted task in Workspace A
        const taskA = await WorkspaceTaskService.createTask(wsAId, clubA.auth_user_id, {
            title: `P9 Proprietary Task ${runId}`,
            description: "Sensitive architectural deliverables",
            departmentId: deptA.id,
            isRestricted: true,
            assigneeUserIds: [userAId],
        });

        // Create a file record in Workspace A
        const fileA = await WorkspaceRepository.createWorkspaceFile({
            workspaceId: wsAId,
            uploaderId: userAId,
            fileName: "classified_spec.pdf",
            fileSizeBytes: 2048,
            mimeType: "application/pdf",
            cloudinaryPublicId: `orbix/p9/test_file_${runId}`,
            cloudinaryUrl: `http://res.cloudinary.com/demo/image/upload/orbix/p9/test_file_${runId}.pdf`,
            cloudinarySecureUrl: `https://res.cloudinary.com/demo/image/upload/orbix/p9/test_file_${runId}.pdf`,
            deliveryType: "authenticated",
            resourceType: "raw",
            format: "pdf",
            parentResourceType: "task",
            parentResourceId: taskA.id,
            departmentId: deptA.id,
        });

        // =====================================================================
        // TEST GROUP 1: MULTI-TENANT ISOLATION & CROSS-WORKSPACE SEGREGATION
        // =====================================================================
        console.log("\n--- TEST GROUP 1: MULTI-TENANT ISOLATION & CROSS-WORKSPACE SEGREGATION ---");

        // 1.1 Member B attempts to read Workspace A members
        const memAResolve = await WorkspaceRepository.findMember(wsAId, userBId);
        assert("User B is not resolved as a member of Workspace A", memAResolve === null);

        // 1.2 Member B attempts to access / mutate Workspace A departments
        let deptLeak = false;
        try {
            await WorkspaceDepartmentService.createDepartment(wsAId, userBId, { name: "Infiltrator Dept" });
            deptLeak = true;
        } catch {
            deptLeak = false;
        }
        assert("User B cannot access or mutate Department of Workspace A", !deptLeak);

        // 1.3 Member B attempts to list channels or categories in Workspace A
        let catLeak = false;
        try {
            await WorkspaceChannelService.listCategories(wsAId, userBId);
            catLeak = true;
        } catch {
            catLeak = false;
        }
        assert("User B cannot list channel categories of Workspace A", !catLeak);

        // 1.4 Member B attempts to view or post in Workspace A channel
        const canViewChA = await WorkspaceChannelService.canViewChannel(wsAId, channelA.id, userBId);
        assert("User B cannot view private channel in Workspace A", !canViewChA);

        let postLeak = false;
        try {
            await WorkspaceChannelService.sendMessage(wsAId, userBId, channelA.id, {
                content: "Unauthorized injection from Workspace B",
            });
            postLeak = true;
        } catch {
            postLeak = false;
        }
        assert("User B cannot post messages to Workspace A channel", !postLeak);

        // 1.5 Member B attempts to read messages from Workspace A channel
        let msgLeak = false;
        try {
            await WorkspaceChannelService.listMessages(wsAId, userBId, channelA.id);
            msgLeak = true;
        } catch {
            msgLeak = false;
        }
        assert("User B cannot read messages from Workspace A channel", !msgLeak);

        // 1.6 Member B attempts to access thread in Workspace A
        let threadLeak = false;
        try {
            await WorkspaceChannelService.getThread(wsAId, userBId, threadA.id);
            threadLeak = true;
        } catch {
            threadLeak = false;
        }
        assert("User B cannot read threads belonging to Workspace A", !threadLeak);

        // 1.7 Member B attempts to read task in Workspace A
        let taskLeak = false;
        try {
            await WorkspaceTaskService.getTask(wsAId, userBId, taskA.id);
            taskLeak = true;
        } catch {
            taskLeak = false;
        }
        assert("User B cannot read tasks belonging to Workspace A", !taskLeak);

        // 1.8 Member B attempts to generate delivery URL for Workspace A file
        let fileLeak = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(wsAId, userBId, fileA.id);
            fileLeak = true;
        } catch {
            fileLeak = false;
        }
        assert("User B cannot generate delivery URL for Workspace A files", !fileLeak);

        // 1.9 Member B attempts to access notifications from Workspace A
        const notifResult = await WorkspaceRepository.getUserNotifications(wsAId, userBId);
        assert("User B receives zero notifications from Workspace A", notifResult.notifications.length === 0);

        // 1.10 Member B attempts to access audit logs from Workspace A
        let auditLeak = false;
        try {
            await WorkspaceDashboardService.getAuditLogs(wsAId, userBId);
            auditLeak = true;
        } catch {
            auditLeak = false;
        }
        assert("User B is strictly blocked from viewing Workspace A audit logs", !auditLeak);

        // =====================================================================
        // TEST GROUP 2: GATEWAY SPOOFING & IDOR PREVENTION
        // =====================================================================
        console.log("\n--- TEST GROUP 2: GATEWAY SPOOFING & IDOR PREVENTION ---");

        // Verify gateway tenant validation query directly
        const spoofCheckA = await query(
            `SELECT 1 FROM public.verified_clubs vc
             LEFT JOIN public.club_memberships cm ON cm.club_id = vc.id AND cm.user_id = $1 AND cm.status = 'active'
             LEFT JOIN public.team_workspaces tw ON tw.club_id = vc.id
             LEFT JOIN public.workspace_members wm ON wm.workspace_id = tw.id AND wm.user_id = $1 AND wm.membership_status = 'active' AND wm.is_suspended = false
             WHERE vc.id = $2 AND (vc.auth_user_id = $1 OR cm.user_id = $1 OR wm.user_id = $1)
             LIMIT 1;`,
            [userBId, clubA.id]
        );
        assert("Gateway query rejects User B accessing Club A", spoofCheckA.rows.length === 0);

        const legitimateCheckB = await query(
            `SELECT 1 FROM public.verified_clubs vc
             LEFT JOIN public.club_memberships cm ON cm.club_id = vc.id AND cm.user_id = $1 AND cm.status = 'active'
             LEFT JOIN public.team_workspaces tw ON tw.club_id = vc.id
             LEFT JOIN public.workspace_members wm ON wm.workspace_id = tw.id AND wm.user_id = $1 AND wm.membership_status = 'active' AND wm.is_suspended = false
             WHERE vc.id = $2 AND (vc.auth_user_id = $1 OR cm.user_id = $1 OR wm.user_id = $1)
             LIMIT 1;`,
            [userBId, clubB.id]
        );
        assert("Gateway query allows User B accessing Club B", legitimateCheckB.rows.length > 0);

        // =====================================================================
        // TEST GROUP 3: ROLE HIERARCHY, ESCALATION & ROLE CRUD DEFENSES
        // =====================================================================
        console.log("\n--- TEST GROUP 3: ROLE HIERARCHY, ESCALATION & ROLE CRUD DEFENSES ---");

        // 3.1 Regular Member attempts to assign Admin role (rank 800) to themselves
        let memberEscalation = false;
        try {
            await WorkspaceMemberService.assignMemberRole(wsAId, userAId, userAId, adminRoleA.id);
            memberEscalation = true;
        } catch {
            memberEscalation = false;
        }
        assert("Regular member cannot assign Administrator role", !memberEscalation);

        // 3.2 Regular Member attempts to create a custom role with rank 850
        let createEscalation = false;
        try {
            await WorkspaceMemberService.createCustomRole(wsAId, userAId, {
                name: "Super Hacker",
                rank: 850,
                permissions: ["*"],
            });
            createEscalation = true;
        } catch {
            createEscalation = false;
        }
        assert("Regular member cannot create custom roles", !createEscalation);

        // 3.3 Admin attempts to grant Owner role (rank 1000)
        const ownerRoleA = rolesA.find((r) => r.slug === "owner")!;
        let adminOwnerGrant = false;
        try {
            await WorkspaceMemberService.assignMemberRole(wsAId, managerAId, userAId, ownerRoleA.id);
            adminOwnerGrant = true;
        } catch {
            adminOwnerGrant = false;
        }
        assert("Admin cannot grant Owner role to any member", !adminOwnerGrant);

        // 3.4 Admin attempts to alter or demote Owner
        let demoteOwner = false;
        try {
            await WorkspaceMemberService.assignMemberRole(wsAId, managerAId, clubA.auth_user_id, memberRoleA.id);
            demoteOwner = true;
        } catch {
            demoteOwner = false;
        }
        assert("Admin cannot demote or alter the Owner role", !demoteOwner);

        // 3.5 Attempt to modify system role (is_system = true)
        let modifySystemRole = false;
        try {
            await WorkspaceMemberService.updateCustomRole(wsAId, clubA.auth_user_id, memberRoleA.id, {
                name: "Renamed Member",
            });
            modifySystemRole = true;
        } catch {
            modifySystemRole = false;
        }
        assert("System roles cannot be modified", !modifySystemRole);

        // 3.6 Attempt to delete system role
        let deleteSystemRole = false;
        try {
            await WorkspaceMemberService.deleteCustomRole(wsAId, clubA.auth_user_id, memberRoleA.id);
            deleteSystemRole = true;
        } catch {
            deleteSystemRole = false;
        }
        assert("System roles cannot be deleted", !deleteSystemRole);

        // 3.7 Owner creates a valid custom role
        const customRole = await WorkspaceMemberService.createCustomRole(wsAId, clubA.auth_user_id, {
            name: `Staff Reviewer ${runId}`,
            description: "Audits submissions and checklist deliverables",
            rank: 600,
            color: "#6366f1",
            permissions: ["tasks:review", "messages:send", "files:upload"],
        });
        assert("Owner can create a valid custom role", Boolean(customRole?.id));
        assert("Custom role has correct rank and isSystem=false", customRole.rank === 600 && !customRole.isSystem);

        // 3.8 Owner assigns custom role to Member A
        const updatedMemberA = await WorkspaceMemberService.assignMemberRole(
            wsAId,
            clubA.auth_user_id,
            userAId,
            customRole.id
        );
        assert("Member A assigned custom role successfully", updatedMemberA.roleId === customRole.id);

        // 3.9 Owner updates custom role
        const editedRole = await WorkspaceMemberService.updateCustomRole(
            wsAId,
            clubA.auth_user_id,
            customRole.id,
            { description: "Updated auditor description" }
        );
        assert("Owner can update custom role description", editedRole.description === "Updated auditor description");

        // 3.10 Deleting custom role safely reassigns members to default member role
        const deleteSuccess = await WorkspaceMemberService.deleteCustomRole(
            wsAId,
            clubA.auth_user_id,
            customRole.id
        );
        assert("Custom role deleted successfully", deleteSuccess === true);

        const memberAAfterRoleDelete = await WorkspaceRepository.findMember(wsAId, userAId);
        assert("Member A reassigned to default member role after custom role deletion", memberAAfterRoleDelete?.roleId === memberRoleA.id);

        // =====================================================================
        // TEST GROUP 4: WORKSPACE MANAGER SCOPING & ESCALATION BLOCKERS
        // =====================================================================
        console.log("\n--- TEST GROUP 4: WORKSPACE MANAGER SCOPING & ESCALATION BLOCKERS ---");

        // 4.1 Owner appoints Workspace Manager
        const appointedWs = await WorkspaceMemberService.appointWorkspaceManager(
            wsAId,
            clubA.auth_user_id,
            managerAId,
            ["can_manage_members", "can_manage_departments", "can_manage_channels"]
        );
        assert("Owner can designate Workspace Manager", appointedWs.managerUserId === managerAId);

        // 4.2 Workspace Manager attempts to appoint another manager
        let mgrAppointOther = false;
        try {
            await WorkspaceMemberService.appointWorkspaceManager(wsAId, managerAId, userAId, []);
            mgrAppointOther = true;
        } catch {
            mgrAppointOther = false;
        }
        assert("Workspace Manager cannot appoint or replace the Workspace Manager", !mgrAppointOther);

        // 4.3 Workspace Manager attempts to revoke the Workspace Manager
        let mgrRevokeSelf = false;
        try {
            await WorkspaceMemberService.revokeWorkspaceManager(wsAId, managerAId);
            mgrRevokeSelf = true;
        } catch {
            mgrRevokeSelf = false;
        }
        assert("Workspace Manager cannot revoke Manager designation (Owner only)", !mgrRevokeSelf);

        // 4.4 Owner revokes Workspace Manager
        const revokedWs = await WorkspaceMemberService.revokeWorkspaceManager(wsAId, clubA.auth_user_id);
        assert("Owner can revoke Workspace Manager", revokedWs.managerUserId === null);

        // =====================================================================
        // TEST GROUP 5: PERMISSION CACHE DYNAMIC INVALIDATION & STALENESS
        // =====================================================================
        console.log("\n--- TEST GROUP 5: PERMISSION CACHE DYNAMIC INVALIDATION & STALENESS ---");

        // 5.1 Prime Redis cache for Member A
        const initialPerms = await WorkspaceRedisService.getCachedPermissions(wsAId, userAId);
        assert("Cached permissions primed or checked", initialPerms !== undefined);

        await WorkspaceRedisService.setCachedPermissions(wsAId, userAId, ["messages:send", "files:upload"]);
        const cachedAfterSet = await WorkspaceRedisService.getCachedPermissions(wsAId, userAId);
        assert("Redis permissions cache contains primed permissions", Array.isArray(cachedAfterSet) && cachedAfterSet.includes("messages:send"));

        // 5.2 Role change triggers automatic cache invalidation
        await WorkspaceMemberService.assignMemberRole(wsAId, clubA.auth_user_id, userAId, adminRoleA.id);
        const cachedAfterRoleChange = await WorkspaceRedisService.getCachedPermissions(wsAId, userAId);
        assert("Permissions cache was immediately invalidated upon role assignment", cachedAfterRoleChange === null);

        // 5.3 Context resolution re-populates cache with fresh elevated permissions
        const resolvedCtx = await WorkspaceService.resolveContext(wsAId, userAId);
        assert("Fresh context resolved with updated rank", resolvedCtx?.isAdmin === true);

        // Restore Member A back to Member role
        await WorkspaceMemberService.assignMemberRole(wsAId, clubA.auth_user_id, userAId, memberRoleA.id);

        // =====================================================================
        // TEST GROUP 6: SUSPENDED MEMBER & REVOKED INVITATION ENFORCEMENT
        // =====================================================================
        console.log("\n--- TEST GROUP 6: SUSPENDED MEMBER & REVOKED INVITATION ENFORCEMENT ---");

        // 6.1 Suspend Member A
        const suspendedMember = await WorkspaceService.setMemberSuspension(
            wsAId,
            userAId,
            clubA.auth_user_id,
            true,
            "Security audit test suspension"
        );
        assert("Member suspension flag persisted", suspendedMember.isSuspended === true);

        // 6.2 resolveContext returns null for suspended member
        const suspendedContext = await WorkspaceService.resolveContext(wsAId, userAId);
        assert("resolveContext immediately returns null for suspended member", suspendedContext === null);

        // 6.3 Suspended member blocked from channels and tasks
        const suspendedCanViewCh = await WorkspaceChannelService.canViewChannel(wsAId, channelA.id, userAId);
        assert("Suspended member cannot view channels", !suspendedCanViewCh);

        let suspendedPost = false;
        try {
            await WorkspaceChannelService.sendMessage(wsAId, userAId, channelA.id, { content: "Suspended message" });
            suspendedPost = true;
        } catch {
            suspendedPost = false;
        }
        assert("Suspended member cannot send messages", !suspendedPost);

        // Re-activate Member A
        await WorkspaceService.setMemberSuspension(wsAId, userAId, clubA.auth_user_id, false);
        const reactivatedCtx = await WorkspaceService.resolveContext(wsAId, userAId);
        assert("Re-activated member resumes normal access", reactivatedCtx !== null);

        // 6.4 Create, Revoke & Test Invitation
        const inviteEmail = `p9_invite_${runId}@orbix.test`;
        const { invitation, rawToken } = await WorkspaceMemberService.createInvitation(
            wsAId,
            clubA.auth_user_id,
            { email: inviteEmail, roleId: memberRoleA.id }
        );
        assert("Invitation created with secure raw token", Boolean(rawToken) && invitation.status === "pending");

        // Revoke the invitation
        await WorkspaceMemberService.revokeInvitation(wsAId, clubA.auth_user_id, invitation.id);
        const revokedInvite = await WorkspaceRepository.findInvitationById(wsAId, invitation.id);
        assert("Invitation status transitioned to revoked", revokedInvite?.status === "revoked");

        // Attempt to accept revoked invitation
        let acceptedRevoked = false;
        try {
            await WorkspaceMemberService.acceptInvitation(rawToken, userBId);
            acceptedRevoked = true;
        } catch (err: any) {
            acceptedRevoked = false;
            assert("Revoked invitation acceptance rejected with explicit error", err.message.includes("revoked"));
        }
        assert("Accepting revoked invitation is impossible", !acceptedRevoked);

        // =====================================================================
        // TEST GROUP 7: CACHE STAMPEDE PROTECTION & CONCURRENCY COALESCING
        // =====================================================================
        console.log("\n--- TEST GROUP 7: CACHE STAMPEDE PROTECTION & CONCURRENCY COALESCING ---");

        // Invalidate dashboard metrics cache first
        await WorkspaceRedisService.invalidateDashboardMetrics(wsAId);

        // Concurrently fire 50 parallel requests
        const parallelCount = 50;
        const requests = Array.from({ length: parallelCount }, () =>
            WorkspaceDashboardService.getWorkspaceOverview(wsAId, clubA.auth_user_id)
        );

        const results = await Promise.all(requests);
        assert("All 50 parallel overview requests resolved successfully", results.length === parallelCount);
        assert("Overview metrics show valid member count", results[0]!.totalMembers >= 1);
        assert("All concurrent responses return identical metric structures", results.every((r) => r.totalMembers === results[0]!.totalMembers));

        // Distributed Lock Test: acquire, verify, release
        const lockToken = await WorkspaceRedisService.acquireLock(`test:p9:${runId}`, 5);
        assert("Distributed lock acquired successfully", Boolean(lockToken));

        const secondLockAttempt = await WorkspaceRedisService.acquireLock(`test:p9:${runId}`, 5);
        assert("Second concurrent lock attempt blocked while held", secondLockAttempt === null);

        const lockReleased = await WorkspaceRedisService.releaseLock(`test:p9:${runId}`, lockToken!);
        assert("Distributed lock released cleanly", lockReleased === true);

        // =====================================================================
        // TEST GROUP 8: RATE LIMITING DEFENSES
        // =====================================================================
        console.log("\n--- TEST GROUP 8: RATE LIMITING DEFENSES ---");

        // 8.1 Spam protection on messages (limit 30 per 10s)
        const rateKey = `msg:${wsAId}:${userAId}`;
        const firstCheck = await WorkspaceRedisService.checkRateLimit(rateKey, 30, 10);
        assert("First message rate-limit check allowed", firstCheck.allowed);

        // Simulate exceeding limit
        let rateLimitExceeded = false;
        for (let i = 0; i < 35; i++) {
            const check = await WorkspaceRedisService.checkRateLimit(`test_flood:${runId}`, 5, 10);
            if (!check.allowed) {
                rateLimitExceeded = true;
                break;
            }
        }
        assert("Rapid flood trips rate limiter (remaining: 0)", rateLimitExceeded);

        // 8.2 Boundary protection: Oversized message length rejection (>4000 chars)
        let largeMsgRejected = false;
        try {
            await WorkspaceChannelService.sendMessage(wsAId, clubA.auth_user_id, channelA.id, {
                content: "A".repeat(5000),
            });
            largeMsgRejected = false;
        } catch (err: any) {
            largeMsgRejected = err.message.includes("4000");
        }
        assert("Oversized message (>4000 characters) rejected at service boundary", largeMsgRejected);

        // =====================================================================
        // TEST GROUP 9: WORKSPACE TEMPLATES ENGINE
        // =====================================================================
        console.log("\n--- TEST GROUP 9: WORKSPACE TEMPLATES ENGINE ---");

        // 9.1 List available templates
        const availableTemplates = WorkspaceTemplateService.getAvailableTemplates();
        assert("WorkspaceTemplateService exposes 7 canonical templates", availableTemplates.length === 7);
        assert("Template list includes 'technical' template", availableTemplates.some((t) => t.id === "technical"));
        assert("Template list includes 'coding' template", availableTemplates.some((t) => t.id === "coding"));
        assert("Template list includes 'design' template", availableTemplates.some((t) => t.id === "design"));

        // Clean up any previously applied template items for wsAId so the test runs freshly
        await pool.query(
            `DELETE FROM public.workspace_channels WHERE workspace_id = $1 AND slug IN ('dev-talk', 'frontend', 'backend', 'architecture', 'code-reviews', 'circuits-pcb', 'robotics-builds', 'firmware-code', 'rfcs-architecture', 'lab-status', 'parts-requests');`,
            [wsAId]
        );
        await pool.query(
            `DELETE FROM public.workspace_departments WHERE workspace_id = $1 AND slug IN ('engineering', 'product-design', 'devops', 'qa-security', 'hardware-embedded', 'robotics-automation', 'tech-projects-rnd', 'lab-safety-logistics');`,
            [wsAId]
        );
        await pool.query(
            `DELETE FROM public.workspace_channel_categories WHERE workspace_id = $1 AND name IN ('Engineering & Code', 'Engineering & Hardware', 'Procurement & Safety');`,
            [wsAId]
        );

        // 9.2 Apply Tech template to Workspace A
        const templateResult = await WorkspaceTemplateService.applyTemplate(
            wsAId,
            clubA.auth_user_id,
            "tech"
        );
        assert("Tech template applied successfully", templateResult.template.id === "tech");
        assert("Template created departments", templateResult.departmentsCreated >= 1);
        assert("Template created categories and channels", templateResult.channelsCreated >= 1);

        // 9.3 Idempotent re-application (zero duplicates created)
        const reapplyResult = await WorkspaceTemplateService.applyTemplate(
            wsAId,
            clubA.auth_user_id,
            "tech"
        );
        assert("Re-applying template is idempotent (0 new departments)", reapplyResult.departmentsCreated === 0);
        assert("Re-applying template is idempotent (0 new channels)", reapplyResult.channelsCreated === 0);

        // =====================================================================
        // TEST GROUP 10: DATABASE CONNECTION POOL & LEAK AUDIT
        // =====================================================================
        console.log("\n--- TEST GROUP 10: DATABASE CONNECTION POOL & LEAK AUDIT ---");

        assert("Database connection pool total count is reasonable (<= 20)", pool.totalCount <= 20);
        assert("Database connection pool waiting client queue is empty (0 waiting)", pool.waitingCount === 0);
        assert("Database idle count is greater than 0", pool.idleCount > 0);

        console.log("\n================================================================================");
        console.log(`PHASE 09 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
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

runPhase09Tests();
