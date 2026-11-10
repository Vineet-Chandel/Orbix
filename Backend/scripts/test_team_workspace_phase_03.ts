// Backend/scripts/test_team_workspace_phase_03.ts
import crypto from "crypto";
import { query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import redis from "../src/redis/client.js";

async function runPhase03Tests() {
    console.log("=================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 03 ACCEPTANCE & VERIFICATION SUITE");
    console.log("DEPARTMENT & WORKSPACE MEMBER MANAGEMENT VERIFICATION");
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
        // TEST SETUP: Retrieve Test Club & Ensure Workspace Exists
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

        // Reset departments for clean test run
        await query(`DELETE FROM public.workspace_departments WHERE workspace_id = $1;`, [workspaceId]);

        // Create 3 temporary test users in public.users for multi-department and invitation testing
        const suffix = Date.now().toString().slice(-6);
        const testUsers: Array<{ id: string; email: string; username: string }> = [];

        for (let i = 1; i <= 4; i++) {
            const uid = crypto.randomUUID();
            const email = `phase03_u${i}_${suffix}@orbix.dev`;
            const username = `p3user${i}_${suffix}`;

            await query(
                `INSERT INTO public.users (id, email, username, firstname, lastname, password, account_type, is_public, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, 'dummy_hash', 'personal', true, NOW(), NOW())
                 ON CONFLICT (id) DO NOTHING;`,
                [uid, email, username, `Test${i}`, `User${suffix}`]
            );

            testUsers.push({ id: uid, email, username });
        }
        console.log(`  Created ${testUsers.length} isolated test users for Phase 03 suite.\n`);

        // Fetch workspace roles
        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const adminRole = roles.find((r) => r.slug === "admin");
        const leadRole = roles.find((r) => r.slug === "dept_lead");
        const memberRole = roles.find((r) => r.slug === "member");

        if (!adminRole || !leadRole || !memberRole) {
            throw new Error("Missing seeded workspace roles.");
        }

        // ---------------------------------------------------------------------
        // TEST SUITE 1: Suggested Department Seeding & Custom Department CRUD
        // ---------------------------------------------------------------------
        console.log("TEST SUITE 1: Department Creation & Lifecycle");

        // Seed 5 default suggested departments
        const seededDepts = await WorkspaceDepartmentService.seedSuggestedDepartments(
            workspaceId,
            club.auth_user_id
        );
        assert("Seeded 5 suggested default departments", seededDepts.length === 5);

        const techDept = seededDepts.find((d) => d.slug === "technical-development");
        const designDept = seededDepts.find((d) => d.slug === "design-branding");
        const opsDept = seededDepts.find((d) => d.slug === "operations-coordination");

        assert("Technical & Development department exists with Code icon", techDept?.icon === "Code");
        assert("Design & Branding department exists with Palette icon", designDept?.icon === "Palette");
        assert("Operations & Coordination department exists", Boolean(opsDept));

        // Test idempotency of seeding
        const reseeded = await WorkspaceDepartmentService.seedSuggestedDepartments(
            workspaceId,
            club.auth_user_id
        );
        assert("Idempotent seeding does not duplicate departments", reseeded.length === 5);

        // Create Custom Department
        const customDeptName = `Research & AI Lab ${suffix}`;
        const customDept = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            club.auth_user_id,
            {
                name: customDeptName,
                description: "Deep learning model tuning and agent experiments",
                icon: "Sparkles",
                color: "#10b981",
                leadUserId: testUsers[0].id,
            }
        );
        assert("Custom department created with primary lead", customDept.name === customDeptName);
        assert("Custom department generates sanitized slug", customDept.slug.startsWith("research-ai-lab"));

        // Department Editing
        const updatedDept = await WorkspaceDepartmentService.updateDepartment(
            workspaceId,
            club.auth_user_id,
            customDept.id,
            {
                description: "Updated AI research mission description",
                color: "#059669",
            }
        );
        assert("Department updated description and color", updatedDept.description === "Updated AI research mission description");

        // Department Archiving & Restoring
        const archived = await WorkspaceDepartmentService.archiveDepartment(
            workspaceId,
            club.auth_user_id,
            customDept.id
        );
        assert("Department is archived (status = 'archived')", archived.status === "archived");

        const activeDepts = await WorkspaceDepartmentService.listDepartments(workspaceId, false);
        assert("Archived department excluded from active list", !activeDepts.some((d) => d.id === customDept.id));

        const restored = await WorkspaceDepartmentService.restoreDepartment(
            workspaceId,
            club.auth_user_id,
            customDept.id
        );
        assert("Department restored (status = 'active')", restored.status === "active");

        // ---------------------------------------------------------------------
        // TEST SUITE 2: Multi-Department Concurrent Membership & Transfers
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 2: Multi-Department Concurrent Membership");

        // Add testUsers[0] as a workspace member first
        const mem0 = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: testUsers[0].id,
            roleId: memberRole.id,
            roleTitle: "Full-Stack Engineer",
        });

        // Add testUsers[0] to Department 1 (Technical) as 'lead'
        const deptMem1 = await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            techDept!.id,
            mem0.id,
            "lead",
            "Technical Director"
        );
        assert("Member added to Technical Department as lead", deptMem1.departmentRole === "lead");

        // Add testUsers[0] to Department 2 (Design) as 'member' concurrently
        const deptMem2 = await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            designDept!.id,
            mem0.id,
            "member",
            "Design Contributor"
        );
        assert("Same member added to Design Department concurrently", deptMem2.departmentRole === "member");

        // Verify member has 2 active departments
        const memberWithDepts = await WorkspaceRepository.findMember(workspaceId, testUsers[0].id);
        assert("Member belongs to exactly 2 departments concurrently", memberWithDepts?.departments?.length === 2);

        // Verify workspace_members table still has exactly 1 row for this user
        const memberCountCheck = await query(
            `SELECT COUNT(*)::int as cnt FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, testUsers[0].id]
        );
        assert("Single workspace_members entity preserved (no duplicates)", memberCountCheck.rows[0].cnt === 1);

        // Test Department Transfer: Transfer from Design to Operations
        await WorkspaceDepartmentService.transferMember(
            workspaceId,
            club.auth_user_id,
            mem0.id,
            designDept!.id,
            opsDept!.id
        );

        const memberAfterTransfer = await WorkspaceRepository.findMember(workspaceId, testUsers[0].id);
        const deptIds = (memberAfterTransfer?.departments || []).map((d) => d.id);
        assert("Member removed from Design department after transfer", !deptIds.includes(designDept!.id));
        assert("Member added to Operations department after transfer", deptIds.includes(opsDept!.id));
        assert("Technical department retained intact during transfer", deptIds.includes(techDept!.id));

        // ---------------------------------------------------------------------
        // TEST SUITE 3: Scoped Department Lead Authority
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 3: Scoped Department Lead Authority");

        // Add testUsers[1] to workspace
        const mem1 = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: testUsers[1].id,
            roleId: memberRole.id,
            roleTitle: "Junior Dev",
        });

        // testUsers[0] is lead of techDept. They should be able to add testUsers[1] to techDept.
        const leadAddedMem = await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            testUsers[0].id, // Lead actor
            techDept!.id,
            mem1.id,
            "member",
            "Junior Dev"
        );
        assert("Department Lead can add member to their own department", Boolean(leadAddedMem.id));

        // testUsers[0] is NOT lead of opsDept. Attempting to add member to opsDept must fail!
        let leadScopedError = false;
        try {
            await WorkspaceDepartmentService.addMemberToDepartment(
                workspaceId,
                testUsers[0].id, // Not a lead of opsDept
                opsDept!.id,
                mem1.id,
                "member",
                "Operations Associate"
            );
        } catch (err: any) {
            leadScopedError = true;
        }
        assert("Department Lead is strictly scoped (cannot manage other departments)", leadScopedError);

        // ---------------------------------------------------------------------
        // TEST SUITE 4: Workspace Manager Lifecycle & Owner Protection
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 4: Workspace Manager Designation & Owner Boundary");

        // Non-owner (testUsers[0]) attempts to appoint manager -> must be rejected
        let nonOwnerManagerError = false;
        try {
            await WorkspaceMemberService.appointWorkspaceManager(
                workspaceId,
                testUsers[0].id,
                testUsers[1].id,
                { can_manage_departments: true }
            );
        } catch (err) {
            nonOwnerManagerError = true;
        }
        assert("Non-owner cannot appoint Workspace Manager", nonOwnerManagerError);

        // Club Owner appoints testUsers[1] as Workspace Manager
        const updatedWsWithManager = await WorkspaceMemberService.appointWorkspaceManager(
            workspaceId,
            club.auth_user_id,
            testUsers[1].id,
            {
                can_manage_departments: true,
                can_manage_members: true,
                can_invite_members: true,
            }
        );
        assert("Club Owner appoints Workspace Manager", updatedWsWithManager.managerUserId === testUsers[1].id);
        assert(
            "Workspace Manager permissions configured in JSONB",
            (updatedWsWithManager.managerPermissions as any)?.can_manage_departments === true
        );

        // Verify in DB directly
        const dbWsCheck = await query(
            `SELECT manager_user_id, manager_appointed_at, manager_permissions FROM public.team_workspaces WHERE id = $1;`,
            [workspaceId]
        );
        assert("Manager persisted in PostgreSQL database", dbWsCheck.rows[0].manager_user_id === testUsers[1].id);

        // Club Owner revokes Workspace Manager
        const revokedWs = await WorkspaceMemberService.revokeWorkspaceManager(
            workspaceId,
            club.auth_user_id
        );
        assert("Club Owner revokes Workspace Manager", revokedWs.managerUserId === null);

        // ---------------------------------------------------------------------
        // TEST SUITE 5: Role Promotion / Demotion Rank Boundary Validation
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 5: Role Assignment & Rank Boundary Enforcement");

        // Promote testUsers[0] to Department Lead (rank 500) by Club Owner (rank 1000)
        const promotedMem0 = await WorkspaceMemberService.assignMemberRole(
            workspaceId,
            club.auth_user_id,
            testUsers[0].id,
            leadRole.id,
            "Engineering Lead"
        );
        assert("Owner promotes member to Department Lead (rank 500)", promotedMem0.role?.rank === 500);

        // Now testUsers[0] (rank 500) attempts to promote testUsers[1] (rank 200) to Admin (rank 800) -> must fail!
        let rankBoundaryViolation = false;
        try {
            await WorkspaceMemberService.assignMemberRole(
                workspaceId,
                testUsers[0].id, // Actor rank 600
                testUsers[1].id, // Target
                adminRole.id,    // Target rank 800
                "Unauthorized Admin"
            );
        } catch (err) {
            rankBoundaryViolation = true;
        }
        assert("Rank boundary enforced: Cannot promote to rank >= actor rank", rankBoundaryViolation);

        // Nobody can assign the "owner" role via assignMemberRole (protected)
        let ownerRoleAssignBlocked = false;
        const ownerRole = roles.find((r) => r.slug === "owner");
        try {
            await WorkspaceMemberService.assignMemberRole(
                workspaceId,
                club.auth_user_id,
                testUsers[0].id,
                ownerRole!.id
            );
        } catch (err) {
            ownerRoleAssignBlocked = true;
        }
        assert("Owner role cannot be assigned via role assignment (protected)", ownerRoleAssignBlocked);

        // ---------------------------------------------------------------------
        // TEST SUITE 6: Cryptographic Invitations Workflow
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 6: Cryptographic Invitations Workflow");

        // Generate invitation for testUsers[2]
        const { invitation, rawToken } = await WorkspaceMemberService.createInvitation(
            workspaceId,
            club.auth_user_id,
            {
                email: testUsers[2].email,
                roleId: memberRole.id,
                departmentId: techDept!.id,
                invitationMessage: "Welcome to the Engineering team!",
            }
        );

        assert("Raw token generated (64 hex characters / 256 bits)", rawToken.length === 64);
        assert("Invitation record created with pending status", invitation.status === "pending");

        // Verify DB only stores SHA-256 hash, not raw token
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        assert("token_hash in DB matches computed SHA-256 hash", invitation.tokenHash === expectedHash);

        const dbTokenCheck = await query(
            `SELECT token_hash, expires_at FROM public.workspace_invitations WHERE id = $1;`,
            [invitation.id]
        );
        assert("Raw token is NEVER stored in database", dbTokenCheck.rows[0].token_hash === expectedHash);

        const expiresAt = new Date(dbTokenCheck.rows[0].expires_at).getTime();
        const now = Date.now();
        const diffDays = Math.round((expiresAt - now) / (1000 * 60 * 60 * 24));
        assert("Invitation expiry is set to 7 days", diffDays === 7);

        // Accept invitation by testUsers[2] using rawToken
        const { member: acceptedMember, workspace: joinedWs } = await WorkspaceMemberService.acceptInvitation(
            rawToken,
            testUsers[2].id
        );
        assert("Invitation accepted: member created in workspace", acceptedMember.userId === testUsers[2].id);
        assert("Department automatically assigned on acceptance", acceptedMember.departments?.some((d) => d.id === techDept!.id) === true);

        // Single-use enforcement: Attempting to accept the same token again must fail!
        let replayAttackPrevented = false;
        try {
            await WorkspaceMemberService.acceptInvitation(rawToken, testUsers[3].id);
        } catch (err: any) {
            replayAttackPrevented = true;
        }
        assert("Single-use token enforced: Replay attempt rejected", replayAttackPrevented);

        // Test Revocation Workflow
        const { invitation: inviteToRevoke, rawToken: rawRevokeToken } = await WorkspaceMemberService.createInvitation(
            workspaceId,
            club.auth_user_id,
            {
                email: testUsers[3].email,
                roleId: memberRole.id,
            }
        );

        await WorkspaceMemberService.revokeInvitation(workspaceId, club.auth_user_id, inviteToRevoke.id);

        let revokedAcceptPrevented = false;
        try {
            await WorkspaceMemberService.acceptInvitation(rawRevokeToken, testUsers[3].id);
        } catch (err: any) {
            revokedAcceptPrevented = true;
        }
        assert("Revoked invitation cannot be accepted", revokedAcceptPrevented);

        // ---------------------------------------------------------------------
        // TEST SUITE 7: Audit Trail Verification
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 7: Audit Trail Verification");

        const auditLogs = await query(`
            SELECT action, actor_id, details 
            FROM public.workspace_audit_logs 
            WHERE workspace_id = $1 
            ORDER BY created_at DESC 
            LIMIT 20;
        `, [workspaceId]);

        const loggedActions = auditLogs.rows.map((r: any) => r.action);
        assert("Audit log recorded: department_created", loggedActions.includes("department_created"));
        assert("Audit log recorded: workspace_manager_appointed", loggedActions.includes("workspace_manager_appointed"));
        assert("Audit log recorded: workspace_manager_revoked", loggedActions.includes("workspace_manager_revoked"));
        assert("Audit log recorded: member_promoted", loggedActions.includes("member_promoted"));
        assert("Audit log recorded: invitation_created", loggedActions.includes("invitation_created"));
        assert("Audit log recorded: invitation_accepted", loggedActions.includes("invitation_accepted"));
        assert("Audit log recorded: invitation_revoked", loggedActions.includes("invitation_revoked"));

    } catch (err) {
        console.error("FATAL TEST EXCEPTION:", err);
        failed++;
    } finally {
        await redis.quit();
        console.log("\n=================================================================");
        console.log(`ACCEPTANCE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
        console.log("=================================================================\n");

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
}

runPhase03Tests();
