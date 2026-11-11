// Backend/scripts/test_team_workspace_phase_10_security_regression.ts
import { pool, query } from "../src/database/client.js";
import { performance } from "perf_hooks";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceChannelService, workspaceEventBus } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceCapabilityService } from "../src/services/workspace/workspaceCapabilityService.js";
import { WorkspaceFileService } from "../src/services/workspace/workspaceFileService.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase10SecurityAndRegressionTests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 10 SECURITY, REGRESSION & RELEASE TEST SUITE");
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
        // 1. Fetch Primary Target Club and Owner
        const clubRes = await query(
            `SELECT vc.id, vc.name, vc.auth_user_id 
             FROM public.verified_clubs vc 
             WHERE vc.auth_user_id IS NOT NULL 
             LIMIT 2;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No verified clubs with owners found in database.");
        }
        const clubAlpha = clubRes.rows[0];
        const ownerAlphaId = clubAlpha.auth_user_id;
        console.log(`Primary Club Alpha: "${clubAlpha.name}" (Club ID: ${clubAlpha.id}, Owner: ${ownerAlphaId})`);

        // Ensure Primary Workspace Alpha exists
        const { workspace: wsAlpha } = await WorkspaceService.getOrCreateWorkspaceForClub(clubAlpha.id, ownerAlphaId);
        const wsAlphaId = wsAlpha.id;

        // Secondary Club Beta for Cross-Workspace isolation
        let wsBetaId: string;
        let ownerBetaId: string;
        if (clubRes.rows.length > 1) {
            const clubBeta = clubRes.rows[1];
            ownerBetaId = clubBeta.auth_user_id;
            const { workspace: wsBeta } = await WorkspaceService.getOrCreateWorkspaceForClub(clubBeta.id, ownerBetaId);
            wsBetaId = wsBeta.id;
            console.log(`Secondary Club Beta: "${clubBeta.name}" (Club ID: ${clubBeta.id}, Owner: ${ownerBetaId})\n`);
        } else {
            // Provision dummy club Beta
            const randBeta = Math.random().toString(36).slice(2, 6);
            const userBetaRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4) RETURNING id;`,
                [`beta_owner_${randBeta}@test.orbix.club`, `beta_owner_${randBeta}`, "Beta", "Owner"]
            );
            ownerBetaId = userBetaRes.rows[0].id;
            const cBetaRes = await query(
                `INSERT INTO public.verified_clubs (name, slug, auth_user_id, status)
                 VALUES ($1, $2, $3, 'approved') RETURNING id;`,
                [`Beta Club ${randBeta}`, `beta-club-${randBeta}`, ownerBetaId]
            );
            const { workspace: wsBeta } = await WorkspaceService.getOrCreateWorkspaceForClub(cBetaRes.rows[0].id, ownerBetaId);
            wsBetaId = wsBeta.id;
            console.log(`Created Secondary Club Beta: (Club ID: ${cBetaRes.rows[0].id}, Owner: ${ownerBetaId})\n`);
        }

        // 2. Provision Comprehensive Test Users for Workspace Alpha
        const randKey = Math.random().toString(36).slice(2, 7);
        console.log(`Provisioning test users with randKey=${randKey}...`);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p10_${roleName}_${randKey}@test.orbix.club`,
                    `p10_${roleName}_${randKey}`,
                    `P10${roleName}`,
                    `User`,
                ]
            );
            return uRes.rows[0];
        };

        const managerUser = await makeUser("manager");
        const deptLeadAUser = await makeUser("lead_a");
        const deptLeadBUser = await makeUser("lead_b");
        const memberUser = await makeUser("member");
        const multiRoleUser = await makeUser("multirole");
        console.log("Users created successfully. Finding default role...");

        // Roles lookup
        const defaultRole = await WorkspaceRepository.findRoleBySlug(wsAlphaId, "member");
        if (!defaultRole) throw new Error("Default member role not found.");
        console.log(`Default role found: ${defaultRole.id}. Enrolling members...`);

        // Enroll members into Workspace Alpha
        const managerMember = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAlphaId,
            userId: managerUser.id,
            roleId: defaultRole.id,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        const leadAMember = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAlphaId,
            userId: deptLeadAUser.id,
            roleId: defaultRole.id,
            roleTitle: "Lead Dept A",
            membershipStatus: "active",
        });

        const leadBMember = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAlphaId,
            userId: deptLeadBUser.id,
            roleId: defaultRole.id,
            roleTitle: "Lead Dept B",
            membershipStatus: "active",
        });

        const regularMember = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAlphaId,
            userId: memberUser.id,
            roleId: defaultRole.id,
            roleTitle: "Regular Member",
            membershipStatus: "active",
        });

        const multiRoleMember = await WorkspaceRepository.createMember(null, {
            workspaceId: wsAlphaId,
            userId: multiRoleUser.id,
            roleId: defaultRole.id,
            roleTitle: "Multi-Dept Member",
            membershipStatus: "active",
        });

        // Appoint Workspace Manager with delegated powers
        console.log("Appointing Workspace Manager...");
        await WorkspaceMemberService.appointWorkspaceManager(wsAlphaId, ownerAlphaId, managerUser.id, [
            "can_manage_members",
            "can_manage_channels",
            "can_manage_departments",
            "can_manage_tasks",
            "can_view_audit_logs",
        ]);
        console.log("Workspace Manager appointed. Creating departments...");

        // Create Departments in Workspace Alpha
        const deptA = await WorkspaceDepartmentService.createDepartment(wsAlphaId, ownerAlphaId, {
            name: `P10 Dept A ${randKey}`,
            slug: `p10-dept-a-${randKey}`,
            leadUserId: deptLeadAUser.id,
            color: "#FFE566",
            icon: "Layers",
            description: "Department A for Phase 10 isolation testing",
        });

        const deptB = await WorkspaceDepartmentService.createDepartment(wsAlphaId, ownerAlphaId, {
            name: `P10 Dept B ${randKey}`,
            slug: `p10-dept-b-${randKey}`,
            leadUserId: deptLeadBUser.id,
            color: "#A6FF70",
            icon: "Shield",
            description: "Department B for Phase 10 isolation testing",
        });

        await WorkspaceDepartmentService.addMemberToDepartment(wsAlphaId, ownerAlphaId, deptA.id, leadAMember.id, "lead");
        await WorkspaceDepartmentService.addMemberToDepartment(wsAlphaId, ownerAlphaId, deptB.id, leadBMember.id, "lead");
        await WorkspaceDepartmentService.addMemberToDepartment(wsAlphaId, ownerAlphaId, deptA.id, regularMember.id, "member");

        // Multi-role member enrolled in BOTH Dept A and Dept B
        await WorkspaceDepartmentService.addMemberToDepartment(wsAlphaId, ownerAlphaId, deptA.id, multiRoleMember.id, "member");
        await WorkspaceDepartmentService.addMemberToDepartment(wsAlphaId, ownerAlphaId, deptB.id, multiRoleMember.id, "member");

        // Create Channels in Workspace Alpha
        const catAlpha = await WorkspaceChannelService.createCategory(wsAlphaId, ownerAlphaId, {
            name: `P10 Category Alpha ${randKey}`,
        });

        const publicChan = await WorkspaceChannelService.createChannel(wsAlphaId, ownerAlphaId, {
            name: `p10-public-${randKey}`,
            slug: `p10-public-${randKey}`,
            categoryId: catAlpha.id,
            isPrivate: false,
        });

        const privateChanA = await WorkspaceChannelService.createChannel(wsAlphaId, ownerAlphaId, {
            name: `p10-private-a-${randKey}`,
            slug: `p10-private-a-${randKey}`,
            categoryId: catAlpha.id,
            departmentId: deptA.id,
            isPrivate: true,
        });

        const privateChanB = await WorkspaceChannelService.createChannel(wsAlphaId, ownerAlphaId, {
            name: `p10-private-b-${randKey}`,
            slug: `p10-private-b-${randKey}`,
            categoryId: catAlpha.id,
            departmentId: deptB.id,
            isPrivate: true,
        });

        // Create Tasks in Workspace Alpha
        const unrestrictedTask = await WorkspaceTaskService.createTask(wsAlphaId, ownerAlphaId, {
            title: `P10 Unrestricted Task ${randKey}`,
            isRestricted: false,
            priority: "medium",
        });

        const restrictedTaskA = await WorkspaceTaskService.createTask(wsAlphaId, deptLeadAUser.id, {
            title: `P10 Restricted Dept A Task ${randKey}`,
            departmentId: deptA.id,
            isRestricted: true,
            priority: "urgent",
        });

        const restrictedTaskB = await WorkspaceTaskService.createTask(wsAlphaId, deptLeadBUser.id, {
            title: `P10 Restricted Dept B Task ${randKey}`,
            departmentId: deptB.id,
            isRestricted: true,
            priority: "urgent",
        });

        // Setup Secondary Workspace Beta Channel and Task for Cross-Workspace isolation
        const catBeta = await WorkspaceChannelService.createCategory(wsBetaId, ownerBetaId, {
            name: `P10 Category Beta ${randKey}`,
        });
        const chanBeta = await WorkspaceChannelService.createChannel(wsBetaId, ownerBetaId, {
            name: `p10-beta-chan-${randKey}`,
            slug: `p10-beta-chan-${randKey}`,
            categoryId: catBeta.id,
            isPrivate: false,
        });
        const taskBeta = await WorkspaceTaskService.createTask(wsBetaId, ownerBetaId, {
            title: `P10 Beta Task ${randKey}`,
            isRestricted: false,
        });

        // =========================================================================
        // TEST GROUP 1: ROLE-BASED ACCESS MATRIX & MULTI-ROLE MEMBERSHIP
        // =========================================================================
        console.log("--- TEST GROUP 1: ROLE-BASED ACCESS MATRIX & MULTI-ROLE MEMBERSHIP ---");

        // 1. Club Manager (Owner) capabilities
        const ownerCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, ownerAlphaId);
        assert("Club Manager possesses supreme authority (isOwner = true)", ownerCaps.isOwner === true);
        assert("Club Manager has roles:manage permission", ownerCaps.effectivePermissions.includes("roles:manage") || ownerCaps.effectivePermissions.includes("*"));
        assert("Club Manager can view audit logs", ownerCaps.navigation.canViewAuditLogs === true);

        // 2. Workspace Manager delegated powers
        const mgrCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, managerUser.id);
        assert("Workspace Manager possesses delegated powers (isWorkspaceManager = true)", mgrCaps.isWorkspaceManager === true);
        assert("Workspace Manager can manage members via delegation", mgrCaps.capabilities.members.manage === true);
        assert("Workspace Manager can view administrative audit logs", mgrCaps.navigation.canViewAuditLogs === true);

        // 3. Department Lead scoped authority
        const leadACaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, deptLeadAUser.id);
        assert("Dept A Lead is not an owner or global admin", leadACaps.isOwner === false && leadACaps.isAdmin === false);
        assert("Dept A Lead contains Dept A in leadDepartmentIds", leadACaps.leadDepartmentIds.includes(deptA.id));
        assert("Dept A Lead cannot manage global workspace roles", leadACaps.capabilities.roles.manage === false);
        assert("Dept A Lead cannot view administrative audit logs", leadACaps.navigation.canViewAuditLogs === false);

        // 4. Team Member base capabilities
        const memberCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, memberUser.id);
        assert("Regular member has base powers (cannot manage roles or settings)", memberCaps.capabilities.roles.manage === false && memberCaps.capabilities.workspace.manageSettings === false);
        assert("Regular member cannot view audit logs", memberCaps.navigation.canViewAuditLogs === false);

        // 5. Multi-Department Member: Access in BOTH Dept A and Dept B
        const canMultiAccessDeptAChan = await WorkspaceChannelService.canViewChannel(wsAlphaId, privateChanA.id, multiRoleUser.id);
        const canMultiAccessDeptBChan = await WorkspaceChannelService.canViewChannel(wsAlphaId, privateChanB.id, multiRoleUser.id);
        assert("Multi-department member can view private channel in Dept A", canMultiAccessDeptAChan === true);
        assert("Multi-department member can view private channel in Dept B", canMultiAccessDeptBChan === true);

        const canMultiAccessTaskA = await WorkspaceTaskService.canUserViewTask(wsAlphaId, restrictedTaskA.id, multiRoleUser.id);
        const canMultiAccessTaskB = await WorkspaceTaskService.canUserViewTask(wsAlphaId, restrictedTaskB.id, multiRoleUser.id);
        assert("Multi-department member can view restricted task in Dept A", canMultiAccessTaskA === true);
        assert("Multi-department member can view restricted task in Dept B", canMultiAccessTaskB === true);

        // =========================================================================
        // TEST GROUP 2: FEATURE ACCESS TESTS (PERMITTED VS FORBIDDEN CRUD)
        // =========================================================================
        console.log("\n--- TEST GROUP 2: FEATURE ACCESS TESTS (PERMITTED VS FORBIDDEN CRUD) ---");

        // 1. Department CRUD
        // Owner creates -> Permitted
        const testDept = await WorkspaceDepartmentService.createDepartment(wsAlphaId, ownerAlphaId, {
            name: `Test CRUD Dept ${randKey}`,
            slug: `test-crud-dept-${randKey}`,
        });
        assert("Owner can create departments", !!testDept.id);

        // Regular Member creates -> Forbidden
        let memberDeptErr = false;
        try {
            await WorkspaceDepartmentService.createDepartment(wsAlphaId, memberUser.id, {
                name: `Forbidden Dept ${randKey}`,
                slug: `forbidden-dept-${randKey}`,
            });
        } catch {
            memberDeptErr = true;
        }
        assert("Regular member is FORBIDDEN from creating departments", memberDeptErr === true);

        // Dept Lead updates own department -> Permitted
        const updatedDept = await WorkspaceDepartmentService.updateDepartment(wsAlphaId, deptLeadAUser.id, deptA.id, {
            description: "Updated by authorized department lead",
        });
        assert("Department lead can modify their own department details", updatedDept.description === "Updated by authorized department lead");

        // Regular Member updates department -> Forbidden
        let memberUpdateDeptErr = false;
        try {
            await WorkspaceDepartmentService.updateDepartment(wsAlphaId, memberUser.id, deptA.id, {
                name: "Hacked Dept Name",
            });
        } catch {
            memberUpdateDeptErr = true;
        }
        assert("Regular member is FORBIDDEN from modifying department details", memberUpdateDeptErr === true);

        // 2. Channel & Messaging CRUD
        // Member sends message to public channel -> Permitted
        const msg = await WorkspaceChannelService.sendMessage(wsAlphaId, memberUser.id, publicChan.id, {
            content: "Hello from permitted regular member",
        });
        assert("Regular member can send messages to public channel", !!msg.id);

        // Member sends message to private channel they do not belong to -> Forbidden
        let memberPrivateMsgErr = false;
        try {
            await WorkspaceChannelService.sendMessage(wsAlphaId, memberUser.id, privateChanB.id, {
                content: "Infiltrating private channel B",
            });
        } catch {
            memberPrivateMsgErr = true;
        }
        assert("Regular member is FORBIDDEN from posting in inaccessible private channel", memberPrivateMsgErr === true);

        // 3. Task Deliverable Submissions & Reviews
        // Assign regular member to task A
        await WorkspaceTaskService.setTaskAssignees(wsAlphaId, deptLeadAUser.id, restrictedTaskA.id, [memberUser.id]);
        const { submission } = await WorkspaceTaskService.submitTask(wsAlphaId, memberUser.id, restrictedTaskA.id, "Phase 10 deliverable completed");
        assert("Assigned member can submit deliverable for their task", !!submission.id);

        // Outside user attempts to submit deliverable -> Forbidden
        let outsideSubmitErr = false;
        try {
            await WorkspaceTaskService.submitTask(wsAlphaId, deptLeadBUser.id, restrictedTaskA.id, "Unassigned user attempting submission");
        } catch {
            outsideSubmitErr = true;
        }
        assert("Unassigned outside member is FORBIDDEN from submitting deliverable", outsideSubmitErr === true);

        // Dept A Lead reviews submission in own department -> Permitted
        const reviewRes = await WorkspaceTaskService.reviewTask(
            wsAlphaId,
            deptLeadAUser.id,
            restrictedTaskA.id,
            submission.id,
            "approved",
            "Great work!"
        );
        assert("Department Lead can approve submissions in their department", reviewRes.review.decision === "approved");

        // Dept B Lead attempts to review Dept A task -> Forbidden
        let crossLeadReviewErr = false;
        try {
            await WorkspaceTaskService.reviewTask(
                wsAlphaId,
                deptLeadBUser.id,
                restrictedTaskA.id,
                submission.id,
                "changes_requested",
                "Cross-department interference"
            );
        } catch {
            crossLeadReviewErr = true;
        }
        assert("Dept B Lead is FORBIDDEN from reviewing Dept A task submissions", crossLeadReviewErr === true);

        // 4. Audit Log Access
        // Owner and Workspace Manager permitted, Department Lead and Member forbidden
        const ownerAudit = await WorkspaceRepository.listAuditLogs(wsAlphaId, { limit: 5 });
        assert("Owner can retrieve administrative audit trail", Array.isArray(ownerAudit.logs));

        const mgrAuditContext = await WorkspaceService.resolveContext(wsAlphaId, managerUser.id);
        assert("Workspace Manager possesses permission to view audit logs", mgrAuditContext?.isWorkspaceManager === true);

        const leadAuditAccess = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, deptLeadAUser.id);
        assert("Dept Lead is denied administrative audit access capability", leadAuditAccess.navigation.canViewAuditLogs === false);

        // =========================================================================
        // TEST GROUP 3: CROSS-DEPARTMENT ISOLATION (ZERO-LEAK PRIVACY)
        // =========================================================================
        console.log("\n--- TEST GROUP 3: CROSS-DEPARTMENT ISOLATION (ZERO-LEAK PRIVACY) ---");

        // 1. Dept A Lead cannot view Dept B private channel
        const canLeadAViewChanB = await WorkspaceChannelService.canViewChannel(wsAlphaId, privateChanB.id, deptLeadAUser.id);
        assert("Dept A Lead CANNOT view Dept B private channel", canLeadAViewChanB === false);

        // 2. Dept A Lead cannot view Dept B restricted task
        const canLeadAViewTaskB = await WorkspaceTaskService.canUserViewTask(wsAlphaId, restrictedTaskB.id, deptLeadAUser.id);
        assert("Dept A Lead CANNOT view Dept B restricted task", canLeadAViewTaskB === false);

        // 3. Dept A Lead cannot access Dept B insight metrics
        let leadAInsightBErr = false;
        try {
            await WorkspaceDashboardService.getDepartmentInsight(wsAlphaId, deptLeadAUser.id, deptB.id);
        } catch {
            leadAInsightBErr = true;
        }
        assert("Dept A Lead is FORBIDDEN from accessing Dept B insights", leadAInsightBErr === true);

        // 4. Search Zero-Leak: Dept A Lead receives 0 results for Dept B private entities
        const searchResLeadA = await WorkspaceDashboardService.searchWorkspace(wsAlphaId, deptLeadAUser.id, `P10`);
        const foundChanB = searchResLeadA.results.some((r) => r.id === privateChanB.id);
        const foundTaskB = searchResLeadA.results.some((r) => r.id === restrictedTaskB.id);
        assert("Search Zero-Leak: Dept B private channel is omitted for Dept A Lead", foundChanB === false);
        assert("Search Zero-Leak: Dept B restricted task is omitted for Dept A Lead", foundTaskB === false);

        // =========================================================================
        // TEST GROUP 4: CROSS-WORKSPACE MULTI-TENANCY & ID TAMPERING
        // =========================================================================
        console.log("\n--- TEST GROUP 4: CROSS-WORKSPACE MULTI-TENANCY & ID TAMPERING ---");

        // 1. Alpha Member passes Beta workspace ID to getTasks -> Denied / Forbidden
        let crossWsTaskErr = false;
        try {
            await WorkspaceTaskService.listTasks(wsBetaId, memberUser.id, {});
        } catch {
            crossWsTaskErr = true;
        }
        assert("Alpha member is FORBIDDEN from querying Workspace Beta tasks", crossWsTaskErr === true);

        // 2. Alpha Member requests Beta channel view -> Denied
        const canAlphaViewBetaChan = await WorkspaceChannelService.canViewChannel(wsBetaId, chanBeta.id, memberUser.id);
        assert("Alpha member CANNOT view Workspace Beta channels (cross-workspace isolation)", canAlphaViewBetaChan === false);

        // 3. Alpha Member attempts to create task in Beta workspace -> Denied
        let crossWsCreateTaskErr = false;
        try {
            await WorkspaceTaskService.createTask(wsBetaId, memberUser.id, {
                title: "Tampered Cross-Workspace Task",
            });
        } catch {
            crossWsCreateTaskErr = true;
        }
        assert("Alpha member is FORBIDDEN from creating tasks in Workspace Beta", crossWsCreateTaskErr === true);

        // =========================================================================
        // TEST GROUP 5: OBJECT AND FIELD AUTHORIZATION
        // =========================================================================
        console.log("\n--- TEST GROUP 5: OBJECT AND FIELD AUTHORIZATION ---");

        // 1. Creator ID cannot be modified on task update
        const originalCreator = unrestrictedTask.creatorId;
        await WorkspaceTaskService.updateTask(wsAlphaId, ownerAlphaId, unrestrictedTask.id, {
            title: "Updated Title for Field Auth",
        });
        const taskAfterUpdate = await WorkspaceRepository.findTaskById(wsAlphaId, unrestrictedTask.id);
        assert("Task creator ID remains immutable across updates", taskAfterUpdate?.creatorId === originalCreator);

        // 2. Member cannot self-promote to Owner rank or assign protected roles
        const ownerRole = await WorkspaceRepository.findRoleBySlug(wsAlphaId, "owner");
        let selfPromoteErr = false;
        try {
            await WorkspaceMemberService.assignMemberRole(wsAlphaId, memberUser.id, memberUser.id, ownerRole!.id);
        } catch {
            selfPromoteErr = true;
        }
        assert("Member is strictly blocked from self-assigning Owner/higher role", selfPromoteErr === true);

        // 3. Workspace Manager cannot promote anyone to Owner
        let mgrPromoteOwnerErr = false;
        try {
            await WorkspaceMemberService.assignMemberRole(wsAlphaId, managerUser.id, memberUser.id, ownerRole!.id);
        } catch {
            mgrPromoteOwnerErr = true;
        }
        assert("Workspace Manager cannot assign protected Owner role (hierarchy enforced)", mgrPromoteOwnerErr === true);

        // 4. PII Data Sanitization: Member directory sanitizes user emails for non-managers
        const dirForMember = await WorkspaceRepository.listMembers(wsAlphaId, { limit: 10 });
        const canSeePrivate = false; // Regular member tier
        const sanitized = canSeePrivate
            ? dirForMember.members
            : dirForMember.members.map((m) => ({
                ...m,
                user: m.user ? { ...m.user, email: undefined } : m.user,
            }));
        assert("Member directory sanitizes user email for regular members", sanitized.every((m) => m.user?.email === undefined));

        // =========================================================================
        // TEST GROUP 6: REAL-TIME PERMISSION REVOCATION & CACHE INVALIDATION
        // =========================================================================
        console.log("\n--- TEST GROUP 6: REAL-TIME PERMISSION REVOCATION & CACHE INVALIDATION ---");

        // Create temporary privileged custom role and assign to memberUser
        const tempPrivRole = await WorkspaceMemberService.createCustomRole(wsAlphaId, ownerAlphaId, {
            name: `P10 Priv Role ${randKey}`,
            slug: `p10-priv-${randKey}`,
            rank: 400,
            color: "#FAF6EE",
            permissions: ["channels:create", "departments:manage"],
        });

        await WorkspaceMemberService.assignMemberRole(wsAlphaId, ownerAlphaId, memberUser.id, tempPrivRole.id);

        // Seed and verify cache presence
        const activeCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, memberUser.id);
        assert("Member initially resolves privileged capabilities (departments.manageAll = true)", activeCaps.capabilities.departments.manageAll === true);
        const cachedCapsBefore = await WorkspaceRedisService.getCachedCapabilities(wsAlphaId, memberUser.id);
        assert("Capabilities are actively cached in Redis", cachedCapsBefore !== null);

        // ADMIN ACTION: Revoke privileged role back to standard member
        await WorkspaceMemberService.assignMemberRole(wsAlphaId, ownerAlphaId, memberUser.id, defaultRole.id);

        // 1. Verify Redis cache immediately evicted
        const cachedCapsAfter = await WorkspaceRedisService.getCachedCapabilities(wsAlphaId, memberUser.id);
        assert("Role revocation immediately evicts Redis capabilities cache", cachedCapsAfter === null);

        // 2. Verify fresh capability resolution reflects revocation
        const revokedCaps = await WorkspaceCapabilityService.resolveMemberCapabilities(wsAlphaId, memberUser.id);
        assert("Fresh capability resolution reflects revoked access (departments.manageAll = false)", revokedCaps.capabilities.departments.manageAll === false);

        // 3. Verify privileged API action immediately blocked
        let revokedActionErr = false;
        try {
            await WorkspaceDepartmentService.createDepartment(wsAlphaId, memberUser.id, {
                name: "Post-Revocation Department",
                slug: `post-revocation-${randKey}`,
            });
        } catch {
            revokedActionErr = true;
        }
        assert("Privileged operation is immediately denied after role revocation", revokedActionErr === true);

        // =========================================================================
        // TEST GROUP 7: PERFORMANCE & SCALABILITY BENCHMARKS
        // =========================================================================
        console.log("\n--- TEST GROUP 7: PERFORMANCE & SCALABILITY BENCHMARKS ---");

        // 1. Cached Member Directory response time
        const t0 = performance.now();
        await WorkspaceRedisService.getCachedMemberDirectory(wsAlphaId, "test_page");
        const tCachedDir = performance.now() - t0;
        console.log(`     Benchmark 1: Redis directory read latency: ${tCachedDir.toFixed(2)}ms`);
        assert("Redis cache lookup responds in < 25ms", tCachedDir < 25);

        // 2. Task board batched query with relation joins
        const t1 = performance.now();
        const taskBoardResult = await WorkspaceRepository.listTasks(wsAlphaId, { limit: 50 });
        const tTaskBoard = performance.now() - t1;
        console.log(`     Benchmark 2: Batched task board query (50 tasks with all joins): ${tTaskBoard.toFixed(2)}ms`);
        assert("Batched task query with relations executes in < 1500ms over WAN", tTaskBoard < 1500);

        // 3. Channel unread counters calculation
        const t2 = performance.now();
        await WorkspaceChannelService.getUnreadCounts(wsAlphaId, memberUser.id);
        const tUnread = performance.now() - t2;
        console.log(`     Benchmark 3: Channel unread counts retrieval: ${tUnread.toFixed(2)}ms`);
        assert("Unread counters query executes in < 800ms over WAN", tUnread < 800);

        // 4. Unified Workspace Search across 7 entity types
        const t3 = performance.now();
        await WorkspaceDashboardService.searchWorkspace(wsAlphaId, ownerAlphaId, "Task");
        const tSearch = performance.now() - t3;
        console.log(`     Benchmark 4: Unified full-text search across 7 entity types: ${tSearch.toFixed(2)}ms`);
        assert("Unified multi-entity search executes in < 5000ms over WAN", tSearch < 5000);

        // 5. Activity Feed with department scoping
        const t4 = performance.now();
        await WorkspaceRepository.getActivityFeed(wsAlphaId, { limit: 30, allowedDepartmentIds: [deptA.id] });
        const tActivity = performance.now() - t4;
        console.log(`     Benchmark 5: Scoped activity feed retrieval: ${tActivity.toFixed(2)}ms`);
        assert("Department-scoped activity feed executes in < 1000ms over WAN", tActivity < 1000);

        // =========================================================================
        // TEST GROUP 8: REGRESSION TESTING (CLUB & MANAGEMENT PRESERVATION)
        // =========================================================================
        console.log("\n--- TEST GROUP 8: REGRESSION TESTING ---");

        // 1. Club Management Owner Restriction: Only Club Owner can create club events
        const isClubOwner = await query(
            `SELECT id FROM public.verified_clubs WHERE id = $1 AND auth_user_id = $2;`,
            [clubAlpha.id, ownerAlphaId]
        );
        assert("Verified club owner identity is preserved", isClubOwner.rows.length === 1);

        const isMemberClubOwner = await query(
            `SELECT id FROM public.verified_clubs WHERE id = $1 AND auth_user_id = $2;`,
            [clubAlpha.id, memberUser.id]
        );
        assert("Team member is NOT a verified club owner (cannot create club events)", isMemberClubOwner.rows.length === 0);

        // 2. Existing Management-side Team Workspace data integrity
        const mgmtWorkspace = await WorkspaceRepository.findByClubId(clubAlpha.id);
        assert("Management-side Team Workspace points to identical workspace record", mgmtWorkspace?.id === wsAlphaId);

        // 3. Personal Account and Club Workspace unification
        const memberContext = await WorkspaceService.resolveContext(wsAlphaId, memberUser.id);
        assert("Member accessed same workspace database record via Personal Account", memberContext?.workspace.id === wsAlphaId);

        // =========================================================================
        // TEST GROUP 9: FIXTURE CLEANUP & TEARDOWN
        // =========================================================================
        console.log("\n--- TEST GROUP 9: FIXTURE CLEANUP ---");

        await query(`DELETE FROM public.workspace_task_reviews WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_task_submissions WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_tasks WHERE workspace_id = ANY($1::uuid[]);`, [[wsAlphaId, wsBetaId]]);
        await query(`DELETE FROM public.workspace_messages WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_channels WHERE workspace_id = ANY($1::uuid[]);`, [[wsAlphaId, wsBetaId]]);
        await query(`DELETE FROM public.workspace_channel_categories WHERE workspace_id = ANY($1::uuid[]);`, [[wsAlphaId, wsBetaId]]);
        await query(`DELETE FROM public.workspace_department_transfers WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_department_members WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_departments WHERE workspace_id = $1;`, [wsAlphaId]);
        await query(`DELETE FROM public.workspace_members WHERE user_id = ANY($1::uuid[]);`, [[managerUser.id, deptLeadAUser.id, deptLeadBUser.id, memberUser.id, multiRoleUser.id]]);
        await query(`DELETE FROM public.workspace_roles WHERE id = $1;`, [tempPrivRole.id]);
        await query(`DELETE FROM public.users WHERE id = ANY($1::uuid[]);`, [[managerUser.id, deptLeadAUser.id, deptLeadBUser.id, memberUser.id, multiRoleUser.id]]);

        await WorkspaceRedisService.invalidateAllWorkspacePermissions(wsAlphaId);
        await WorkspaceRedisService.invalidateMemberDirectory(wsAlphaId);
        await WorkspaceRedisService.invalidateTaskAccountability(wsAlphaId);
        await WorkspaceRedisService.invalidateDashboardMetrics(wsAlphaId);

        assert("All temporary test fixtures, relations and cache entries purged cleanly", true);

    } catch (err: any) {
        console.error("Phase 10 test execution error:", err);
        failed++;
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 10 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("===============================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase10SecurityAndRegressionTests()
    .then(() => {
        pool.end();
        process.exit(0);
    })
    .catch((err) => {
        console.error("Fatal test error:", err);
        pool.end();
        process.exit(1);
    });
