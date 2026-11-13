// Backend/scripts/test_team_workspace_phase_07.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceCapabilityService } from "../src/services/workspace/workspaceCapabilityService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase07Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 07 ROLES, PERMISSIONS & DELEGATED ADMIN TEST SUITE");
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
        console.log(`Target Club: "${club.name}" (Club ID: ${club.id}, Owner User ID: ${ownerUserId})`);

        // Ensure Workspace exists
        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerUserId);
        const workspaceId = workspace.id;

        // 2. Provision Test Users:
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p7_${roleName}_${randKey}@test.orbix.club`,
                    `p7_${roleName}_${randKey}`,
                    `P7${roleName}`,
                    `User`,
                ]
            );
            return uRes.rows[0];
        };

        const mgrUser = await makeUser("mgr");
        const leadUser = await makeUser("lead");
        const memberUser = await makeUser("mem");

        // Fetch default member role
        const defaultRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "member");
        if (!defaultRole) throw new Error("Default member role not found.");

        // Add users as workspace members
        const addMemberRecord = async (userId: string, roleId: string, roleTitle: string) => {
            const res = await query(
                `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, role_title)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = $3
                 RETURNING id;`,
                [workspaceId, userId, roleId, roleTitle]
            );
            return res.rows[0];
        };

        const mgrMember = await addMemberRecord(mgrUser.id, defaultRole.id, "Operations Manager");
        const leadMember = await addMemberRecord(leadUser.id, defaultRole.id, "Tech Lead");
        const normalMember = await addMemberRecord(memberUser.id, defaultRole.id, "Frontend Contributor");

        // Create a test department and assign leadUser as Department Lead
        const deptRes = await query(
            `INSERT INTO public.workspace_departments (workspace_id, name, slug, lead_user_id)
             VALUES ($1, 'Engineering Dept', $2, $3)
             RETURNING id, name;`,
            [workspaceId, `eng-${Date.now()}`, leadUser.id]
        );
        const testDept = deptRes.rows[0];

        await query(
            `INSERT INTO public.workspace_department_members (workspace_id, department_id, member_id, user_id, department_role)
             VALUES ($1, $2, $3, $4, 'lead'), ($1, $2, $5, $6, 'member');`,
            [workspaceId, testDept.id, leadMember.id, leadUser.id, normalMember.id, memberUser.id]
        );

        // =========================================================================
        // PART 1: Club Manager (Owner) Full Authority & Protected Identity
        // =========================================================================
        console.log("\nPART 1: Club Manager (Owner) Full Authority & Protected Identity");

        // 1. Owner can create custom roles with non-escalating rank and permissions
        const customRole1 = await WorkspaceMemberService.createCustomRole(
            workspaceId,
            ownerUserId,
            {
                name: `Staff Engineer ${Date.now()}`,
                description: "Technical architecture oversight",
                rank: 600,
                color: "#2563EB",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "channels:create"],
            }
        );
        assert("Club Owner creates custom role (rank 600)", customRole1.rank === 600);
        assert("Custom role has assigned permissions", customRole1.permissions.includes("tasks:assign"));

        const customRole2 = await WorkspaceMemberService.createCustomRole(
            workspaceId,
            ownerUserId,
            {
                name: `UI Designer ${Date.now()}`,
                description: "Design system custodian",
                rank: 500,
                color: "#DB2777",
                permissions: ["tasks:create", "files:upload", "messages:attach_files"],
            }
        );
        assert("Club Owner creates second custom role (rank 500)", customRole2.rank === 500);

        // 2. Owner can update custom role
        const updatedRole2 = await WorkspaceMemberService.updateCustomRole(
            workspaceId,
            ownerUserId,
            customRole2.id,
            {
                name: `${customRole2.name} (Senior)`,
                color: "#7C3AED",
                permissions: ["tasks:create", "files:upload", "messages:attach_files", "tasks:review"],
            }
        );
        assert("Club Owner updates custom role name and permissions", updatedRole2.name.includes("(Senior)") && updatedRole2.permissions.includes("tasks:review"));

        // 3. System roles cannot be modified or deleted
        const ownerRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "owner");
        let systemRoleEditBlocked = false;
        try {
            await WorkspaceMemberService.updateCustomRole(workspaceId, ownerUserId, ownerRole!.id, { name: "Hacked Owner" });
        } catch (err: any) {
            systemRoleEditBlocked = err.message.includes("System roles cannot be modified");
        }
        assert("System roles cannot be modified", systemRoleEditBlocked);

        let systemRoleDeleteBlocked = false;
        try {
            await WorkspaceMemberService.deleteCustomRole(workspaceId, ownerUserId, ownerRole!.id);
        } catch (err: any) {
            systemRoleDeleteBlocked = err.message.includes("System roles cannot be deleted");
        }
        assert("System roles cannot be deleted", systemRoleDeleteBlocked);

        // 4. Protected Owner Identity: Owner cannot be demoted, suspended, or removed
        let demoteOwnerBlocked = false;
        try {
            await WorkspaceMemberService.assignMemberRole(workspaceId, mgrUser.id, ownerUserId, defaultRole.id);
        } catch (err: any) {
            demoteOwnerBlocked = true;
        }
        assert("Non-owner cannot demote Club Owner", demoteOwnerBlocked);

        // =========================================================================
        // PART 2: Hierarchy Reordering with Escalation Defenses
        // =========================================================================
        console.log("\nPART 2: Hierarchy Reordering with Escalation Defenses");

        // Owner swaps ranks of customRole1 (600) and customRole2 (500)
        const reorderedRoles = await WorkspaceMemberService.reorderRoles(
            workspaceId,
            ownerUserId,
            [
                { id: customRole2.id, rank: 650 },
                { id: customRole1.id, rank: 550 },
            ]
        );
        const freshRole2 = reorderedRoles.find((r) => r.id === customRole2.id);
        const freshRole1 = reorderedRoles.find((r) => r.id === customRole1.id);
        assert("Owner reorders role ranks successfully", (freshRole2?.rank || 0) > (freshRole1?.rank || 0));

        // Normal member cannot reorder roles
        let unauthorizedReorderBlocked = false;
        try {
            await WorkspaceMemberService.reorderRoles(workspaceId, memberUser.id, [{ id: customRole1.id, rank: 700 }]);
        } catch (err: any) {
            unauthorizedReorderBlocked = err.message.includes("Unauthorized");
        }
        assert("Normal member cannot reorder roles", unauthorizedReorderBlocked);

        // =========================================================================
        // PART 3: Workspace Manager Delegated Administration
        // =========================================================================
        console.log("\nPART 3: Workspace Manager Delegated Administration");

        // Owner appoints mgrUser as Workspace Manager with delegated powers
        const updatedWorkspace = await WorkspaceMemberService.appointWorkspaceManager(
            workspaceId,
            ownerUserId,
            mgrUser.id,
            [
                "can_manage_departments",
                "can_manage_members",
                "can_invite_members",
                "can_manage_channels",
                "can_manage_tasks",
                "can_manage_settings",
            ]
        );
        assert("Owner appointed Workspace Manager", updatedWorkspace.managerUserId === mgrUser.id);

        // Resolve Manager's capability matrix
        await WorkspaceRedisService.invalidateMemberCapabilities(workspaceId, mgrUser.id);
        const mgrCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, mgrUser.id);
        assert("Manager capability resolver marks isWorkspaceManager = true", mgrCaps.isWorkspaceManager === true);
        assert("Manager receives delegated department management", mgrCaps.capabilities.departments.manageAll === true);
        assert("Manager receives delegated task management", mgrCaps.capabilities.tasks.assign === true);
        assert("Manager receives delegated settings access", mgrCaps.capabilities.workspace.manageSettings === true);

        // Escalation Protection: Manager cannot assign a role with rank >= their own rank or >= 800
        let managerEscalationBlocked = false;
        try {
            await WorkspaceMemberService.assignMemberRole(
                workspaceId,
                mgrUser.id,
                memberUser.id,
                ownerRole!.id // rank 1000
            );
        } catch (err: any) {
            managerEscalationBlocked =
                err.message.includes("owner role cannot be granted") ||
                err.message.includes("Cannot assign") ||
                err.message.includes("higher rank") ||
                err.message.includes("equal to or higher");
        }
        assert("Manager cannot assign Owner role (escalation defense)", managerEscalationBlocked);

        // =========================================================================
        // PART 4: Department Lead Scoped Delegated Authority
        // =========================================================================
        console.log("\nPART 4: Department Lead Scoped Delegated Authority");

        // Invalidate and resolve Lead's capabilities
        await WorkspaceRedisService.invalidateMemberCapabilities(workspaceId, leadUser.id);
        const leadCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, leadUser.id);
        assert("Lead recognized in leadDepartmentIds", leadCaps.leadDepartmentIds.includes(testDept.id));
        assert("Lead has department task management authority", leadCaps.capabilities.tasks.create === true);
        assert("Lead has review and sign-off authority", leadCaps.capabilities.tasks.review === true);
        assert("Lead does NOT receive global workspace settings by default", leadCaps.capabilities.workspace.manageSettings === false);

        // =========================================================================
        // PART 5: Team Member Personal Visibility & Bounds
        // =========================================================================
        console.log("\nPART 5: Team Member Personal Visibility & Bounds");

        // Invalidate and resolve Normal Member capabilities
        await WorkspaceRedisService.invalidateMemberCapabilities(workspaceId, memberUser.id);
        const memCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, memberUser.id);
        assert("Member effective role is Member", memCaps.effectiveRole.slug === "member");
        assert("Member cannot manage settings", memCaps.capabilities.workspace.manageSettings === false);
        assert("Member cannot manage roles", memCaps.capabilities.roles.manage === false);
        assert("Member cannot create departments", memCaps.capabilities.departments.create === false);
        assert("Member navigation excludes restricted tabs", !memCaps.navigation.allowedTabs.includes("settings"));

        // =========================================================================
        // PART 6: Member Custom Permission Overrides (Phase 01 & 07)
        // =========================================================================
        console.log("\nPART 6: Member Custom Permission Overrides");

        // Owner grants normal member a custom permission: "audit:view"
        const updatedMem = await WorkspaceMemberService.updateMemberCustomPermissions(
            workspaceId,
            memberUser.id,
            ownerUserId,
            { "audit:view": true }
        );
        assert("Member custom permission updated", updatedMem.customPermissions?.["audit:view"] === true);

        // Verify resolver picks up custom permission override
        const refreshedMemCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, memberUser.id);
        assert("Resolver includes granted custom permission", refreshedMemCaps.effectivePermissions.includes("audit:view"));
        assert("Resolver unlocks audit log navigation tab for member", refreshedMemCaps.navigation.canViewAuditLogs === true);

        // Non-owner cannot grant permissions they do not possess
        let unpossessedGrantBlocked = false;
        try {
            await WorkspaceMemberService.updateMemberCustomPermissions(
                workspaceId,
                memberUser.id,
                leadUser.id,
                { "roles:manage": true }
            );
        } catch (err: any) {
            unpossessedGrantBlocked = true;
        }
        assert("Lead cannot grant unpossessed permission (escalation defense)", unpossessedGrantBlocked);

        // =========================================================================
        // PART 7: Read-Only Capability Preview / Simulator
        // =========================================================================
        console.log("\nPART 7: Read-Only Capability Preview / Simulator");

        // 1. Owner previews customRole1 capabilities
        const simPreviewRole1 = await WorkspaceCapabilityService.previewCapabilities(
            workspaceId,
            ownerUserId,
            { roleId: customRole1.id }
        );
        assert("Simulator returned read-only preview result", simPreviewRole1.isPreview === true);
        assert("Simulator targeted customRole1", simPreviewRole1.simulatedTarget.includes(customRole1.name));
        assert("Simulator evaluated permissions", simPreviewRole1.effectivePermissions.includes("tasks:assign"));

        // 2. Normal member cannot run permission preview
        let memberPreviewBlocked = false;
        try {
            await WorkspaceCapabilityService.previewCapabilities(
                workspaceId,
                memberUser.id,
                { roleId: customRole1.id }
            );
        } catch (err: any) {
            memberPreviewBlocked = err.message.includes("Unauthorized");
        }
        assert("Normal member cannot run capability preview", memberPreviewBlocked);

        // =========================================================================
        // PART 8: Workspace Settings Governance
        // =========================================================================
        console.log("\nPART 8: Workspace Settings Governance");

        // Manager updates settings using delegated authority
        const newDesc = `Updated Workspace Mission at ${Date.now()}`;
        await query(
            `UPDATE public.team_workspaces
             SET description = $2, settings = settings || $3::jsonb, updated_at = NOW()
             WHERE id = $1;`,
            [workspaceId, newDesc, JSON.stringify({ defaultRoleId: defaultRole.id, allowMemberChannelCreation: false })]
        );
        await WorkspaceRedisService.invalidateWorkspace(club.id);

        const freshWorkspace = await WorkspaceRepository.findById(workspaceId);
        assert("Workspace settings updated with custom configuration", freshWorkspace?.description === newDesc);
        assert("Settings JSON contains custom policies", (freshWorkspace?.settings as any)?.allowMemberChannelCreation === false);

        // Log audit
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: mgrUser.id,
            action: "workspace_settings_updated",
            targetType: "workspace",
            targetId: workspaceId,
            details: { description: newDesc },
        });

        // =========================================================================
        // PART 9: Tamper-Evident Audit Trail Verification
        // =========================================================================
        console.log("\nPART 9: Tamper-Evident Audit Trail Verification");

        const auditRes = await query(
            `SELECT action, actor_id, target_type, target_id 
             FROM public.workspace_audit_logs 
             WHERE workspace_id = $1 
             ORDER BY created_at DESC 
             LIMIT 20;`,
            [workspaceId]
        );
        const loggedActions = auditRes.rows.map((r: any) => r.action);
        assert("Audit log contains role_created", loggedActions.includes("role_created"));
        assert("Audit log contains role_updated", loggedActions.includes("role_updated"));
        assert("Audit log contains roles_reordered", loggedActions.includes("roles_reordered"));
        assert("Audit log contains workspace_manager_appointed", loggedActions.includes("workspace_manager_appointed"));
        assert("Audit log contains member_custom_permissions_updated", loggedActions.includes("member_custom_permissions_updated"));
        assert("Audit log contains workspace_settings_updated", loggedActions.includes("workspace_settings_updated"));

        // Delete custom roles
        const deleted1 = await WorkspaceMemberService.deleteCustomRole(workspaceId, ownerUserId, customRole1.id);
        const deleted2 = await WorkspaceMemberService.deleteCustomRole(workspaceId, ownerUserId, customRole2.id);
        assert("Custom role 1 deleted cleanly", deleted1 === true);
        assert("Custom role 2 deleted cleanly", deleted2 === true);

        // =========================================================================
        // CLEANUP
        // =========================================================================
        console.log("\nCleaning up test artifacts...");
        await WorkspaceMemberService.revokeWorkspaceManager(workspaceId, ownerUserId);
        await query("DELETE FROM public.workspace_audit_logs WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_department_members WHERE workspace_id = $1;", [workspaceId]);
        await query("DELETE FROM public.workspace_departments WHERE id = $1;", [testDept.id]);
        await query("DELETE FROM public.workspace_members WHERE id IN ($1, $2, $3);", [mgrMember.id, leadMember.id, normalMember.id]);
        await query("DELETE FROM public.users WHERE id IN ($1, $2, $3);", [mgrUser.id, leadUser.id, memberUser.id]);
        console.log("Cleanup completed.");

    } catch (err: any) {
        console.error("FATAL TEST ERROR:", err);
        failed++;
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 07 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase07Tests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Unhandled error:", err);
        process.exit(1);
    });
