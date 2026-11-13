// Backend/scripts/test_team_workspace_phase_01_capabilities.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceCapabilityService } from "../src/services/workspace/workspaceCapabilityService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase01CapabilityTests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 01 CAPABILITY RESOLVER ACCEPTANCE TEST SUITE");
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
        // ---------------------------------------------------------------------
        // SETUP: Discover verified club & workspace for testing
        // ---------------------------------------------------------------------
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

        const { workspace, member: ownerMember } = await WorkspaceService.getOrCreateWorkspaceForClub(
            club.id,
            club.auth_user_id
        );
        const workspaceId = workspace.id;

        // Fetch standard roles
        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const ownerRole = roles.find((r) => r.slug === "owner")!;
        const adminRole = roles.find((r) => r.slug === "admin")!;
        const deptLeadRole = roles.find((r) => r.slug === "dept_lead")!;
        const memberRole = roles.find((r) => r.slug === "member")!;

        // ---------------------------------------------------------------------
        // TEST 1: Club Manager (Owner, Rank 1000) Capabilities
        // ---------------------------------------------------------------------
        console.log("TEST 1: Club Manager (Owner, Rank 1000)");
        const ownerCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, club.auth_user_id);

        assert("Owner is recognized with isOwner = true", ownerCaps.isOwner === true);
        assert("Owner is recognized with isAdmin = true", ownerCaps.isAdmin === true);
        assert("Owner has highestRank = 1000", ownerCaps.highestRank === 1000);
        assert("Owner can manage members up to rank 1000", ownerCaps.highestManageableRank === 1000);
        assert("Owner can manage workspace settings", ownerCaps.capabilities.workspace.manageSettings === true);
        assert("Owner can view and manage all departments", ownerCaps.capabilities.departments.manageAll === true);
        assert("Owner can manage members and assign roles", ownerCaps.capabilities.members.manage === true && ownerCaps.capabilities.members.assignRole === true);
        assert("Owner can review and approve tasks", ownerCaps.capabilities.tasks.approve === true);
        assert("Owner can view audit logs", ownerCaps.capabilities.audit.view === true);
        assert("Owner navigation includes all tabs", ownerCaps.navigation.canViewAuditLogs === true && ownerCaps.navigation.canViewSettings === true);

        // ---------------------------------------------------------------------
        // SETUP TEST USERS
        // ---------------------------------------------------------------------
        console.log("\nPROVISIONING TEST PERSONAS...");
        const ts = Date.now().toString(36);

        async function createTestUser(roleSlug: string, prefix: string) {
            const email = `test.${prefix}.${ts}.${Math.random().toString(36).slice(2, 6)}@orbix.dev`;
            const username = `u_${Math.random().toString(36).slice(2, 12)}`;
            const res = await query(`
                INSERT INTO public.users (firstname, lastname, email, password, username, account_type, is_public)
                VALUES ($1, $2, $3, 'dummy_hash', $4, 'personal', true)
                RETURNING id, username, email;
            `, [prefix, "Persona", email, username]);
            return res.rows[0];
        }

        const userMgr = await createTestUser("admin", "manager");
        const userLead = await createTestUser("dept_lead", "lead");
        const userMember = await createTestUser("member", "member");
        const userCustom = await createTestUser("custom", "custom");

        // Create 2 test departments
        const dept1 = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Tech Dept ${ts}`,
            slug: `tech-${ts}`,
            description: "Engineering Department",
            icon: "Code",
            color: "#2563eb",
            leadUserId: userLead.id,
            displayOrder: 1,
        });

        const dept2 = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Design Dept ${ts}`,
            slug: `design-${ts}`,
            description: "Design & UX Department",
            icon: "Palette",
            color: "#ec4899",
            leadUserId: null,
            displayOrder: 2,
        });

        // ---------------------------------------------------------------------
        // TEST 2: Workspace Manager (Rank 800) Capabilities
        // ---------------------------------------------------------------------
        console.log("\nTEST 2: Workspace Manager (Rank 800)");
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: userMgr.id,
            roleId: adminRole.id,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        // Appoint as Workspace Manager on team_workspaces with delegated powers
        await query(
            `UPDATE public.team_workspaces 
             SET manager_user_id = $2,
                 manager_permissions = '{"can_manage_departments": true, "can_manage_members": true, "can_manage_channels": true, "can_manage_tasks": true, "can_manage_settings": true}'::jsonb
             WHERE id = $1;`,
            [workspaceId, userMgr.id]
        );

        const mgrCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userMgr.id);
        assert("Workspace Manager is recognized with isWorkspaceManager = true", mgrCaps.isWorkspaceManager === true);
        assert("Workspace Manager has isAdmin = true", mgrCaps.isAdmin === true);
        assert("Workspace Manager highestRank = 800", mgrCaps.highestRank === 800);
        assert("Workspace Manager highestManageableRank = 799 (cannot manage equal or higher rank)", mgrCaps.highestManageableRank === 799);
        assert("Workspace Manager can manage departments", mgrCaps.capabilities.departments.manageAll === true);
        assert("Workspace Manager can manage members", mgrCaps.capabilities.members.manage === true);
        assert("Workspace Manager can review tasks", mgrCaps.capabilities.tasks.review === true);
        assert("Workspace Manager can view audit logs", mgrCaps.capabilities.audit.view === true);
        assert("Workspace Manager navigation has audit tab", mgrCaps.navigation.canViewAuditLogs === true);

        // ---------------------------------------------------------------------
        // TEST 3: Department Lead (Rank 500) Scoped Capabilities
        // ---------------------------------------------------------------------
        console.log("\nTEST 3: Department Lead (Rank 500)");
        const leadMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: userLead.id,
            departmentId: dept1.id,
            roleId: deptLeadRole.id,
            roleTitle: "Tech Lead",
            membershipStatus: "active",
        });

        // Add to dept1 as Lead in workspace_department_members
        await WorkspaceRepository.addDepartmentMember(null, {
            workspaceId,
            departmentId: dept1.id,
            memberId: leadMember.id,
            userId: userLead.id,
            departmentRole: "lead",
            roleTitle: "Lead Engineer",
            assignedBy: club.auth_user_id,
        });

        const leadCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userLead.id);
        assert("Dept Lead has isOwner = false", leadCaps.isOwner === false);
        assert("Dept Lead has isAdmin = false", leadCaps.isAdmin === false);
        assert("Dept Lead has highestRank = 500", leadCaps.highestRank === 500);
        assert("Dept Lead highestManageableRank = 499", leadCaps.highestManageableRank === 499);
        assert("Dept Lead has leadDepartmentIds containing dept1", leadCaps.leadDepartmentIds.includes(dept1.id));
        assert("Dept Lead CAN manage assigned department", leadCaps.capabilities.departments.manageAssigned === true);
        assert("Dept Lead CANNOT manage all departments", leadCaps.capabilities.departments.manageAll === false);
        assert("Dept Lead manageableDepartmentIds includes dept1", leadCaps.capabilities.departments.manageableDepartmentIds.includes(dept1.id));
        assert("Dept Lead manageableDepartmentIds does NOT include dept2", !leadCaps.capabilities.departments.manageableDepartmentIds.includes(dept2.id));
        assert("Dept Lead can review tasks in their department", leadCaps.capabilities.tasks.review === true);
        assert("Dept Lead CANNOT view audit logs", leadCaps.capabilities.audit.view === false);
        assert("Dept Lead navigation omits audit tab", leadCaps.navigation.canViewAuditLogs === false);
        assert("Dept Lead navigation includes all-tasks (department scope)", leadCaps.navigation.canViewAllTasks === true);

        // ---------------------------------------------------------------------
        // TEST 4: Team Member (Rank 200) Base Capabilities
        // ---------------------------------------------------------------------
        console.log("\nTEST 4: Team Member (Rank 200)");
        const tmMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: userMember.id,
            departmentId: dept1.id,
            roleId: memberRole.id,
            roleTitle: "Developer",
            membershipStatus: "active",
        });

        await WorkspaceRepository.addDepartmentMember(null, {
            workspaceId,
            departmentId: dept1.id,
            memberId: tmMember.id,
            userId: userMember.id,
            departmentRole: "member",
            roleTitle: "Developer",
            assignedBy: userLead.id,
        });

        const memberCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userMember.id);
        assert("Member has isOwner = false, isAdmin = false", !memberCaps.isOwner && !memberCaps.isAdmin);
        assert("Member has highestRank = 200", memberCaps.highestRank === 200);
        assert("Member has NO leadDepartmentIds", memberCaps.leadDepartmentIds.length === 0);
        assert("Member CANNOT manage assigned department", memberCaps.capabilities.departments.manageAssigned === false);
        assert("Member CANNOT review tasks", memberCaps.capabilities.tasks.review === false);
        assert("Member CANNOT assign tasks", memberCaps.capabilities.tasks.assign === false);
        assert("Member CAN create tasks", memberCaps.capabilities.tasks.create === true);
        assert("Member CAN participate in chat (sendMessages)", memberCaps.capabilities.channels.sendMessages === true);
        assert("Member CANNOT create channels", memberCaps.capabilities.channels.create === false);
        assert("Member CANNOT view audit logs", memberCaps.capabilities.audit.view === false);
        assert("Member navigation omits audit tab", memberCaps.navigation.canViewAuditLogs === false);
        assert("Member navigation omits invitations tab", memberCaps.navigation.canViewInvitations === false);

        // ---------------------------------------------------------------------
        // TEST 5: Multiple Departments (Lead of Dept 1, Member of Dept 2)
        // ---------------------------------------------------------------------
        console.log("\nTEST 5: Multi-Department Assignment & Scoped Isolation");
        // Add Dept Lead user as regular member of Dept 2
        await WorkspaceRepository.addDepartmentMember(null, {
            workspaceId,
            departmentId: dept2.id,
            memberId: leadMember.id,
            userId: userLead.id,
            departmentRole: "member",
            roleTitle: "Collaborator",
            assignedBy: club.auth_user_id,
        });

        // Invalidate capabilities to reflect new department membership
        await WorkspaceRedisService.invalidateMemberCapabilities(workspaceId, userLead.id);
        const multiDeptCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userLead.id);

        assert("User is lead in exactly 1 department (dept1)", multiDeptCaps.leadDepartmentIds.length === 1 && multiDeptCaps.leadDepartmentIds.includes(dept1.id));
        assert("User is member in 2 departments (dept1 and dept2)", multiDeptCaps.memberDepartmentIds.length === 2 && multiDeptCaps.memberDepartmentIds.includes(dept2.id));

        // Test hasCapability helper with department scope
        const canManageDept1 = await WorkspaceCapabilityService.hasCapability(
            workspaceId,
            userLead.id,
            "departments",
            "manageAssigned",
            { departmentId: dept1.id }
        );
        const canManageDept2 = await WorkspaceCapabilityService.hasCapability(
            workspaceId,
            userLead.id,
            "departments",
            "manageAssigned",
            { departmentId: dept2.id }
        );

        assert("Capability Helper: Can manage assigned Dept 1 (Lead)", canManageDept1 === true);
        assert("Capability Helper: CANNOT manage assigned Dept 2 (Regular Member only)", canManageDept2 === false);

        // ---------------------------------------------------------------------
        // TEST 6: Custom Role Support
        // ---------------------------------------------------------------------
        console.log("\nTEST 6: Custom Role Resolution");
        const customRole = await WorkspaceRepository.createRole(null, {
            workspaceId,
            name: `Task Auditor ${ts}`,
            slug: `auditor-${ts}`,
            description: "Custom role with task review and audit log permissions",
            rank: 450,
            isSystem: false,
            color: "#f59e0b",
            permissions: ["messages:send", "tasks:create", "tasks:review", "audit:view"],
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: userCustom.id,
            roleId: customRole.id,
            roleTitle: "Security Auditor",
            membershipStatus: "active",
        });

        const customCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userCustom.id);
        assert("Custom role is mapped with slug auditor-*", customCaps.effectiveRole.slug === `auditor-${ts}`);
        assert("Custom role rank is 450", customCaps.highestRank === 450);
        assert("Custom role grants tasks:review capability", customCaps.capabilities.tasks.review === true);
        assert("Custom role grants audit:view capability", customCaps.capabilities.audit.view === true);
        assert("Custom role does NOT grant departments:manageAll", customCaps.capabilities.departments.manageAll === false);
        assert("Navigation exposes Audit Trail tab due to audit:view", customCaps.navigation.canViewAuditLogs === true);

        // ---------------------------------------------------------------------
        // TEST 7: Member-Specific Custom Override (Grant)
        // ---------------------------------------------------------------------
        console.log("\nTEST 7: Member-Specific Custom Override (Grant)");
        // Grant tasks:review to regular team member (userMember)
        await WorkspaceMemberService.updateMemberCustomPermissions(
            workspaceId,
            userMember.id,
            club.auth_user_id, // Granted by Owner
            { "tasks:review": true }
        );

        const memberOverriddenCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userMember.id);
        assert("Member has custom override for tasks:review", memberOverriddenCaps.effectivePermissions.includes("tasks:review"));
        assert("Member now holds tasks.review capability", memberOverriddenCaps.capabilities.tasks.review === true);
        assert("Member still CANNOT manage departments", memberOverriddenCaps.capabilities.departments.manageAll === false);

        // ---------------------------------------------------------------------
        // TEST 8: Member-Specific Custom Override (Denial / Revocation)
        // ---------------------------------------------------------------------
        console.log("\nTEST 8: Member-Specific Custom Override (Denial)");
        // Deny channels:create to dept lead (userLead)
        await WorkspaceMemberService.updateMemberCustomPermissions(
            workspaceId,
            userLead.id,
            club.auth_user_id,
            { "channels:create": false }
        );

        const leadRevokedCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userLead.id);
        assert("Dept Lead channels:create is revoked by custom denial", !leadRevokedCaps.effectivePermissions.includes("channels:create"));
        assert("Dept Lead channels.create capability is now false", leadRevokedCaps.capabilities.channels.create === false);

        // ---------------------------------------------------------------------
        // TEST 9: Hierarchy Enforcement on Member Management
        // ---------------------------------------------------------------------
        console.log("\nTEST 9: Role Hierarchy Position Enforcement");
        // Dept Lead (rank 500) trying to manage Workspace Manager (rank 800) -> Rejected
        let leadManageAdmin = false;
        try {
            await WorkspaceMemberService.assignMemberRole(
                workspaceId,
                userLead.id, // Actor is Dept Lead (rank 500)
                userMgr.id,  // Target is Workspace Manager (rank 800)
                memberRole.id
            );
            leadManageAdmin = true;
        } catch (err: any) {
            leadManageAdmin = false;
        }
        assert("Hierarchy Rule: Dept Lead cannot modify Workspace Manager role", leadManageAdmin === false);

        // Dept Lead can manage department members within department scope
        assert("Dept Lead has department-level member management (departments.manageMembers)", leadCaps.capabilities.departments.manageMembers === true);
        assert("Dept Lead does not hold global workspace member management (members.manage)", leadCaps.capabilities.members.manage === false);

        // Workspace Manager hierarchy checks with targetRank
        const mgrCanManageMember = await WorkspaceCapabilityService.hasCapability(
            workspaceId,
            userMgr.id,
            "members",
            "manage",
            { targetRank: 200 }
        );
        const mgrCanManageAdmin = await WorkspaceCapabilityService.hasCapability(
            workspaceId,
            userMgr.id,
            "members",
            "manage",
            { targetRank: 800 }
        );

        assert("Capability Check: Workspace Manager can manage member with rank 200", mgrCanManageMember === true);
        assert("Capability Check: Workspace Manager CANNOT manage peer with rank 800", mgrCanManageAdmin === false);

        // ---------------------------------------------------------------------
        // TEST 10: Suspended Member Isolation
        // ---------------------------------------------------------------------
        console.log("\nTEST 10: Suspended Member Isolation");
        await WorkspaceService.setMemberSuspension(
            workspaceId,
            userMember.id,
            club.auth_user_id,
            true,
            "Temporarily suspended for audit test"
        );

        // Invalidate capabilities to reflect suspension
        await WorkspaceRedisService.invalidateMemberCapabilities(workspaceId, userMember.id);
        const suspendedCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userMember.id);

        assert("Suspended member has workspace.view = false", suspendedCaps.capabilities.workspace.view === false);
        assert("Suspended member has tasks.viewAssigned = false", suspendedCaps.capabilities.tasks.viewAssigned === false);
        assert("Suspended member has channels.sendMessages = false", suspendedCaps.capabilities.channels.sendMessages === false);
        assert("Suspended member allowedTabs is empty", suspendedCaps.navigation.allowedTabs.length === 0);

        // ---------------------------------------------------------------------
        // TEST 11: Redis Caching & Invalidation Verification
        // ---------------------------------------------------------------------
        console.log("\nTEST 11: Redis Cache Write-Through & Invalidation");
        // Unsuspend member
        await WorkspaceService.setMemberSuspension(
            workspaceId,
            userMember.id,
            club.auth_user_id,
            false
        );

        // Call resolve: should prime Redis cache
        const freshCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, userMember.id);
        assert("Fresh capabilities resolved after un-suspension", freshCaps.capabilities.workspace.view === true);

        // Read directly from Redis to verify cache prime
        const cachedInRedis = await WorkspaceRedisService.getCachedCapabilities(workspaceId, userMember.id);
        assert("Capabilities are stored and retrievable from Redis cache", !!cachedInRedis && cachedInRedis.userId === userMember.id);

        // Invalidate via service
        await WorkspaceCapabilityService.invalidate(workspaceId, userMember.id);
        const afterInvalidate = await WorkspaceRedisService.getCachedCapabilities(workspaceId, userMember.id);
        assert("Invalidate removes key from Redis immediately", afterInvalidate === null);

        // ---------------------------------------------------------------------
        // SUMMARY
        // ---------------------------------------------------------------------
        console.log("\n===============================================================================");
        console.log(`PHASE 01 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log("===============================================================================");

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err: any) {
        console.error("FATAL ERROR in Phase 01 Tests:", err);
        process.exit(1);
    }
}

runPhase01CapabilityTests();
