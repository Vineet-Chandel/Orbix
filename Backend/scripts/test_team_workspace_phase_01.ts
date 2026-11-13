// Backend/scripts/test_team_workspace_phase_01.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";
import redis from "../src/redis/client.js";

async function runPhase01Tests() {
    console.log("=================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 01 ACCEPTANCE & VERIFICATION SUITE");
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
        // TEST 1: Database Schema & Foundational Tables Verification
        // ---------------------------------------------------------------------
        console.log("TEST SUITE 1: Relational Schema & Table Architecture");
        const tablesQuery = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN (
                'team_workspaces',
                'workspace_roles',
                'workspace_departments',
                'workspace_members',
                'workspace_permission_overrides',
                'workspace_channel_categories',
                'workspace_channels',
                'workspace_tasks',
                'workspace_files',
                'workspace_audit_logs',
                'workspace_notifications'
              );
        `);

        const foundTables = tablesQuery.rows.map((r: any) => r.table_name);
        assert("All 11 foundational workspace tables exist in PostgreSQL", foundTables.length === 11);

        // Check Unique constraint on club_id in team_workspaces
        const uqConstraintQuery = await query(`
            SELECT conname 
            FROM pg_constraint 
            WHERE conname = 'uq_team_workspaces_club_id';
        `);
        assert("Constraint uq_team_workspaces_club_id enforces 1:1 club workspace", uqConstraintQuery.rows.length > 0);

        // ---------------------------------------------------------------------
        // TEST 2: Retrieve Existing Verified Clubs for Isolation Testing
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 2: Club Discovery & Multi-Tenant Provisioning");
        const clubsQuery = await query(`
            SELECT id, auth_user_id, name, slug 
            FROM public.verified_clubs 
            ORDER BY created_at ASC 
            LIMIT 2;
        `);

        if (clubsQuery.rows.length === 0) {
            throw new Error("No verified clubs available in database for testing.");
        }

        const clubA = clubsQuery.rows[0];
        console.log(`  Target Club A: "${clubA.name}" (ID: ${clubA.id})`);

        // Test Idempotent Provisioning
        const res1 = await WorkspaceService.getOrCreateWorkspaceForClub(clubA.id, clubA.auth_user_id);
        assert("Workspace provisioned or retrieved successfully", !!res1.workspace && !!res1.member);
        assert("Workspace belongs to target Club A", res1.workspace.clubId === clubA.id);
        assert("Workspace owner matches verified club auth_user_id", res1.workspace.ownerId === clubA.auth_user_id);

        // Second call must be idempotent: returns identical workspace without duplication
        const res2 = await WorkspaceService.getOrCreateWorkspaceForClub(clubA.id, clubA.auth_user_id);
        assert("Idempotency: Repeated call returns identical workspace ID", res2.workspace.id === res1.workspace.id);
        assert("Idempotency: Flag isNew is false on second invocation", res2.isNew === false);

        // Verify only 1 record exists in DB for clubA
        const countQuery = await query(
            `SELECT COUNT(*)::int as count FROM public.team_workspaces WHERE club_id = $1;`,
            [clubA.id]
        );
        assert("Exactly one workspace row exists in PostgreSQL for Club A", countQuery.rows[0].count === 1);

        // ---------------------------------------------------------------------
        // TEST 3: Roles & Permission Hierarchy
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 3: Roles & Permissions Seed Verification");
        const roles = await WorkspaceRepository.listRoles(res1.workspace.id);
        assert("Default system roles seeded (at least 5 roles)", roles.length >= 5);

        const ownerRole = roles.find((r) => r.slug === "owner");
        const adminRole = roles.find((r) => r.slug === "admin");
        const memberRole = roles.find((r) => r.slug === "member");

        assert("Owner role exists with rank 1000", !!ownerRole && ownerRole.rank === 1000);
        assert("Admin role exists with rank 800", !!adminRole && adminRole.rank === 800);
        assert("Member role exists with rank 200", !!memberRole && memberRole.rank === 200);
        assert("Owner role carries wildcard permissions", Array.isArray(ownerRole?.permissions) && ownerRole?.permissions.includes("*"));

        // ---------------------------------------------------------------------
        // TEST 4: Membership Association & Suspension State
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 4: Membership Association & Suspension Isolation");
        const ownerMember = await WorkspaceRepository.findMember(res1.workspace.id, clubA.auth_user_id);
        assert("Club owner is assigned Owner role in workspace", !!ownerMember && ownerMember.role?.slug === "owner");
        assert("Owner membership status is active", ownerMember?.membershipStatus === "active");
        assert("Owner is not suspended", ownerMember?.isSuspended === false);

        // Create a secondary dummy user in users table for member testing
        const tempEmail = `workspace.test.${Date.now()}@example.com`;
        const tempUserRes = await query(`
            INSERT INTO public.users (firstname, lastname, email, password, username, account_type, is_public)
            VALUES ('Workspace', 'Tester', $1, 'dummy_hash', $2, 'personal', true)
            RETURNING id, username, account_type, is_public;
        `, [tempEmail, `ws_user_${Date.now().toString(36)}`]);

        const tempUser = tempUserRes.rows[0];
        assert("Secondary test user created", !!tempUser && !!tempUser.id);

        // Add user as Member
        const addedMember = await WorkspaceRepository.createMember(null, {
            workspaceId: res1.workspace.id,
            userId: tempUser.id,
            roleId: memberRole!.id,
            roleTitle: "Junior Developer",
            membershipStatus: "active",
        });
        assert("User added as active workspace member", addedMember.membershipStatus === "active" && !addedMember.isSuspended);

        // Test Member Suspension
        const suspendedMember = await WorkspaceService.setMemberSuspension(
            res1.workspace.id,
            tempUser.id,
            clubA.auth_user_id,
            true,
            "Violation of workspace code of conduct"
        );
        assert("Member marked as suspended in workspace", suspendedMember.isSuspended === true);
        assert("Membership status updated to 'suspended'", suspendedMember.membershipStatus === "suspended");
        assert("Suspension reason recorded in database", suspendedMember.suspendedReason === "Violation of workspace code of conduct");

        // Verify Global Account Integrity: User's global Orbix account is untouched
        const globalUserRes = await query(`SELECT account_type, is_public FROM public.users WHERE id = $1;`, [tempUser.id]);
        assert("Global Orbix account type unchanged ('personal')", globalUserRes.rows[0].account_type === "personal");
        assert("Global Orbix profile publicity unchanged (true)", globalUserRes.rows[0].is_public === true);

        // Test Un-suspension
        const unsuspendedMember = await WorkspaceService.setMemberSuspension(
            res1.workspace.id,
            tempUser.id,
            clubA.auth_user_id,
            false
        );
        assert("Member restored to active state", unsuspendedMember.isSuspended === false && unsuspendedMember.membershipStatus === "active");

        // ---------------------------------------------------------------------
        // TEST 5: Cross-Workspace Tenant Isolation
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 5: Cross-Workspace Tenant Isolation");
        const fakeWorkspaceId = "00000000-0000-0000-0000-000000000000";
        const foreignMemberCheck = await WorkspaceRepository.findMember(fakeWorkspaceId, tempUser.id);
        assert("Querying user against wrong workspace returns null", foreignMemberCheck === null);

        const foreignRoles = await WorkspaceRepository.listRoles(fakeWorkspaceId);
        assert("Querying roles for wrong workspace returns empty array", foreignRoles.length === 0);

        // ---------------------------------------------------------------------
        // TEST 6: Redis Infrastructure & Namespace Integration
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 6: Redis Shared Infrastructure & Namespaces");
        const redisHealth = await WorkspaceRedisService.isHealthy();
        assert("Redis health check returns true (PONG)", redisHealth === true);

        const testKey = WorkspaceRedisService.buildKey("test", "isolation", "key1");
        assert("Redis key uses configured namespace 'orbix:team-workspace:'", testKey.startsWith("orbix:team-workspace:"));

        // Test Permissions Caching & Invalidation
        await WorkspaceRedisService.setCachedPermissions(res1.workspace.id, tempUser.id, ["messages:send", "tasks:create"]);
        const cachedPerms = await WorkspaceRedisService.getCachedPermissions(res1.workspace.id, tempUser.id);
        assert("Permissions cached in Redis match payload", Array.isArray(cachedPerms) && cachedPerms.includes("messages:send"));

        await WorkspaceRedisService.invalidateMemberPermissions(res1.workspace.id, tempUser.id);
        const invalidatedPerms = await WorkspaceRedisService.getCachedPermissions(res1.workspace.id, tempUser.id);
        assert("Permissions cache evicted on invalidation trigger", invalidatedPerms === null);

        // Test Rate Limiter
        const rl1 = await WorkspaceRedisService.checkRateLimit(`test_user_${Date.now()}`, 5, 60);
        assert("Rate limiter allows initial request", rl1.allowed === true && rl1.remaining === 4);

        // ---------------------------------------------------------------------
        // TEST 7: Audit Logging Verification
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 7: Audit Trail Verification");
        const auditLogsQuery = await query(
            `SELECT action, target_type, details 
             FROM public.workspace_audit_logs 
             WHERE workspace_id = $1 
             ORDER BY created_at DESC;`,
            [res1.workspace.id]
        );
        assert("Workspace audit logs recorded in database", auditLogsQuery.rows.length >= 2);
        const actions = auditLogsQuery.rows.map((r: any) => r.action);
        assert("Contains 'workspace_provisioned' audit record", actions.includes("workspace_provisioned"));
        assert("Contains 'member_suspended' audit record", actions.includes("member_suspended"));

        // Cleanup temporary test member
        await query(`DELETE FROM public.workspace_members WHERE user_id = $1;`, [tempUser.id]);
        await query(`DELETE FROM public.users WHERE id = $1;`, [tempUser.id]);

    } catch (err: any) {
        console.error("FATAL SUITE ERROR:", err.message || err);
        failed++;
    } finally {
        await pool.end();
        if (redis && redis.status === "ready") {
            redis.disconnect();
        }
    }

    console.log("\n=================================================================");
    console.log(`PHASE 01 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("=================================================================\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase01Tests();
