// Backend/scripts/test_team_workspace_phase_03_recognition.ts
/**
 * ORBIX TEAM WORKSPACE — PHASE 03 MANAGER-SIDE AWARDING EXPERIENCE TEST SUITE
 * 
 * Verifies:
 * 1. Club Manager awards a Department Lead
 * 2. Club Manager awards a member
 * 3. Workspace Manager awards a Department Lead
 * 4. Workspace Manager awards a member
 * 5. Workspace Manager cannot exceed their budget
 * 6. Workspace Manager cannot award a superior (Club Owner or Peer Manager)
 * 7. Both issuers cannot award themselves
 * 8. Analytics & Manager Budget Listing
 * 9. Ephemeral test fixture cleanup
 */

import { query, pool } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";

async function runPhase03Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 03 MANAGER-SIDE AWARDING EXPERIENCE TESTS");
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

    let wsId = "";
    const createdUserIds: string[] = [];

    try {
        // Step 1: Locate primary verified club
        const clubRes = await query(
            `SELECT vc.id, vc.name, vc.slug, vc.auth_user_id 
             FROM public.verified_clubs vc 
             WHERE vc.auth_user_id IS NOT NULL 
             ORDER BY vc.created_at ASC 
             LIMIT 1;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No verified clubs found.");
        }
        const club = clubRes.rows[0];
        const ownerId = club.auth_user_id;
        console.log(`Auditing Club: "${club.name}" (Club ID: ${club.id}, Owner: ${ownerId})\n`);

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerId);
        wsId = workspace.id;

        // Step 2: Create ephemeral users representing the hierarchy
        console.log("--- 1. Setting Up Test Hierarchy (Owner > Manager > Lead > Member) ---");
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const res = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username;`,
                [`p03_${roleName}_${randKey}@test.orbix.club`, `p03_${roleName}_${randKey}`, `P03${roleName}`, "User"]
            );
            createdUserIds.push(res.rows[0].id);
            return res.rows[0];
        };

        const mgrUser = await makeUser("manager");
        const peerMgrUser = await makeUser("peermgr");
        const leadUser = await makeUser("lead");
        const memberUser = await makeUser("member");

        const roles = await WorkspaceRepository.listRoles(wsId);
        const managerRole = roles.find((r) => r.slug === "admin" || r.slug === "manager" || r.rank === 800);
        const leadRole = roles.find((r) => r.slug === "dept_lead" || r.slug === "lead" || r.rank === 600);
        const defaultMemberRole = roles.find((r) => r.slug === "member" || r.rank === 200);

        if (!managerRole || !defaultMemberRole) {
            throw new Error("Required workspace roles missing.");
        }

        // Add Manager
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: mgrUser.id,
            roleId: managerRole.id,
            roleTitle: "Engineering Manager",
            membershipStatus: "active",
        });

        // Add Peer Manager
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: peerMgrUser.id,
            roleId: managerRole.id,
            roleTitle: "Operations Manager",
            membershipStatus: "active",
        });

        // Add Department Lead
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: leadUser.id,
            roleId: leadRole ? leadRole.id : defaultMemberRole.id,
            roleTitle: "Frontend Lead",
            membershipStatus: "active",
        });

        // Add Member
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: memberUser.id,
            roleId: defaultMemberRole.id,
            roleTitle: "Software Engineer",
            membershipStatus: "active",
        });

        console.log("  Hierarchy members created successfully.");

        // Step 3: Test 1 - Club Manager awards a Department Lead
        console.log("\n--- 2. Test 1: Club Manager awards a Department Lead ---");
        const ownerAwardLead = await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
            recipientUserId: leadUser.id,
            amount: 25,
            categorySlugOrId: "leadership",
            reason: "Exceptional departmental leadership and sprint coordination.",
        });
        assert("Club Manager successfully awarded Department Lead (+25 Orbits)", !!ownerAwardLead && ownerAwardLead.pointsDelta === 25);
        assert("Transaction type is 'award'", ownerAwardLead.transactionType === "award");
        assert("Recipient matches Department Lead ID", ownerAwardLead.recipientId === leadUser.id);
        const leadSummaryAfterOwner = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, leadUser.id);
        assert("Department Lead balance is 25 Orbits", leadSummaryAfterOwner.currentBalance === 25);

        // Step 4: Test 2 - Club Manager awards a Member
        console.log("\n--- 3. Test 2: Club Manager awards a Member ---");
        const ownerAwardMember = await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
            recipientUserId: memberUser.id,
            amount: 30,
            categorySlugOrId: "impact",
            reason: "Delivered critical performance optimization reducing latency across club portal.",
        });
        assert("Club Manager successfully awarded Member (+30 Orbits)", !!ownerAwardMember && ownerAwardMember.pointsDelta === 30);
        assert("Recipient matches Member ID", ownerAwardMember.recipientId === memberUser.id);
        const memberSummaryAfterOwner = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, memberUser.id);
        assert("Member balance is 30 Orbits", memberSummaryAfterOwner.currentBalance === 30);

        // Step 5: Allocate Monthly Budget to Workspace Manager
        console.log("\n--- 4. Budget Allocation for Workspace Manager ---");
        const allocatedBudget = await WorkspaceRecognitionService.allocateManagerBudget(
            wsId,
            ownerId,
            mgrUser.id,
            200
        );
        assert("Owner allocated 200 Orbits budget to Manager", allocatedBudget.allocatedBudget === 200);
        assert("Manager used budget initialized to 0", Number(allocatedBudget.usedBudget) === 0);
        assert("Manager remaining budget is 200", Number(allocatedBudget.remainingBudget) === 200);

        // Step 6: Test 3 - Workspace Manager awards a Department Lead
        console.log("\n--- 5. Test 3: Workspace Manager awards a Department Lead ---");
        const mgrAwardLead = await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: leadUser.id,
            amount: 25,
            categorySlugOrId: "teamwork",
            reason: "Supported cross-functional collaboration and unblocked fellow engineers.",
        });
        assert("Workspace Manager successfully awarded Department Lead (+25 Orbits)", !!mgrAwardLead && mgrAwardLead.pointsDelta === 25);

        const currentMonth = new Date().toISOString().slice(0, 7);
        const budgetAfterLeadAward = await WorkspaceRepository.getOrCreateRecognitionBudget(
            null,
            wsId,
            mgrUser.id,
            currentMonth
        );
        assert("Manager used budget updated to 25", budgetAfterLeadAward.usedBudget === 25);
        assert("Manager remaining budget is 175", budgetAfterLeadAward.remainingBudget === 175);

        const leadSummaryAfterMgr = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, leadUser.id);
        assert("Lead total balance is 50 Orbits (25 from Owner + 25 from Manager)", leadSummaryAfterMgr.currentBalance === 50);

        // Step 7: Test 4 - Workspace Manager awards a Member
        console.log("\n--- 6. Test 4: Workspace Manager awards a Member ---");
        const mgrAwardMember = await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: memberUser.id,
            amount: 35,
            categorySlugOrId: "problem_solving",
            reason: "Resolved complex database deadlock issues under tight timeline.",
        });
        assert("Workspace Manager successfully awarded Member (+35 Orbits)", !!mgrAwardMember && mgrAwardMember.pointsDelta === 35);

        const budgetAfterMemberAward = await WorkspaceRepository.getOrCreateRecognitionBudget(
            null,
            wsId,
            mgrUser.id,
            currentMonth
        );
        assert("Manager used budget updated to 60 (25 + 35)", budgetAfterMemberAward.usedBudget === 60);
        assert("Manager remaining budget is 140", budgetAfterMemberAward.remainingBudget === 140);

        const memberSummaryAfterMgr = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, memberUser.id);
        assert("Member total balance is 65 Orbits (30 from Owner + 35 from Manager)", memberSummaryAfterMgr.currentBalance === 65);

        // Step 8: Test 5 - Workspace Manager cannot exceed their budget
        console.log("\n--- 7. Test 5: Workspace Manager cannot exceed their budget ---");
        // Manager has 140 remaining.
        // Award 50 -> remaining 90
        await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: leadUser.id,
            amount: 50,
            categorySlugOrId: "reliability",
            reason: "Consistent delivery and timely completion of architectural milestones.",
        });
        // Award 50 -> remaining 40
        await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: leadUser.id,
            amount: 50,
            categorySlugOrId: "reliability",
            reason: "Consistent delivery and timely completion of security upgrades.",
        });

        // Now manager used 160, remaining is 40.
        // Attempting to award 45 (> 40 remaining and <= 50 max points) must be rejected!
        let budgetExceededBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
                recipientUserId: memberUser.id,
                amount: 45,
                categorySlugOrId: "teamwork",
                reason: "Attempting to exceed remaining monthly award budget.",
            });
        } catch (err: any) {
            budgetExceededBlocked = err.message.includes("Insufficient recognition award budget");
        }
        assert("Workspace Manager cannot exceed their budget (Attempt blocked)", budgetExceededBlocked);

        // Step 9: Test 6 - Workspace Manager cannot award a superior
        console.log("\n--- 8. Test 6: Workspace Manager cannot award a superior ---");
        // A. Manager attempting to award Club Owner (rank 1000)
        let mgrAwardOwnerBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
                recipientUserId: ownerId,
                amount: 20,
                categorySlugOrId: "teamwork",
                reason: "Attempting to award the supreme club owner.",
            });
        } catch (err: any) {
            mgrAwardOwnerBlocked = err.message.includes("Club Owner");
        }
        assert("Workspace Manager cannot award Club Owner (Blocked)", mgrAwardOwnerBlocked);

        // B. Manager attempting to award Peer Manager (rank >= 800)
        let mgrAwardPeerBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
                recipientUserId: peerMgrUser.id,
                amount: 20,
                categorySlugOrId: "teamwork",
                reason: "Attempting to award equal peer manager.",
            });
        } catch (err: any) {
            mgrAwardPeerBlocked = err.message.includes("equal or superior managerial rank");
        }
        assert("Workspace Manager cannot award Peer Manager (Blocked)", mgrAwardPeerBlocked);

        // Step 10: Test 7 - Both issuers cannot award themselves
        console.log("\n--- 9. Test 7: Both issuers cannot award themselves ---");
        // A. Owner self-award
        let ownerSelfAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: ownerId,
                amount: 25,
                categorySlugOrId: "leadership",
                reason: "Owner attempting to self-award Orbits.",
            });
        } catch (err: any) {
            ownerSelfAwardBlocked = err.message.includes("cannot award Orbits to themselves");
        }
        assert("Club Manager cannot self-award (Blocked)", ownerSelfAwardBlocked);

        // B. Manager self-award
        let mgrSelfAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
                recipientUserId: mgrUser.id,
                amount: 20,
                categorySlugOrId: "leadership",
                reason: "Manager attempting to self-award Orbits.",
            });
        } catch (err: any) {
            mgrSelfAwardBlocked = err.message.includes("cannot award Orbits to themselves");
        }
        assert("Workspace Manager cannot self-award (Blocked)", mgrSelfAwardBlocked);

        // Step 11: Analytics & Budgets Listing Verification
        console.log("\n--- 10. Analytics & Manager Budget Listing Verification ---");
        const budgetsList = await WorkspaceRecognitionService.listBudgets(wsId, ownerId);
        assert("Budgets list returns manager records", budgetsList.length >= 1);
        const mgrBudgetEntry = budgetsList.find((b: any) => b.userId === mgrUser.id);
        assert("Manager budget entry found with user details", !!mgrBudgetEntry && !!mgrBudgetEntry.user);
        assert("Manager budget allocated is 200", mgrBudgetEntry.allocatedBudget === 200);
        assert("Manager budget used is 160", mgrBudgetEntry.usedBudget === 160);

        const analytics = await WorkspaceRecognitionService.getAnalytics(wsId, ownerId);
        assert("Analytics returns totalOrbitsAwarded", analytics.totalOrbitsAwarded >= 115);
        assert("Analytics returns categoryBreakdown array", Array.isArray(analytics.categoryBreakdown) && analytics.categoryBreakdown.length > 0);
        assert("Analytics returns topRecipients array", Array.isArray(analytics.topRecipients) && analytics.topRecipients.length > 0);
        assert("Analytics returns topIssuers array", Array.isArray(analytics.topIssuers) && analytics.topIssuers.length > 0);

    } catch (error: any) {
        console.error("FATAL ERROR during Phase 03 Recognition Test execution:", error);
        failed++;
    } finally {
        // Step 12: Ephemeral test fixture cleanup
        console.log("\n--- 11. Ephemeral Fixture Cleanup ---");
        if (createdUserIds.length > 0 && wsId) {
            try {
                await query(
                    `DELETE FROM public.workspace_recognition_ledger WHERE workspace_id = $1 AND (issuer_id = ANY($2::uuid[]) OR recipient_id = ANY($2::uuid[]));`,
                    [wsId, createdUserIds]
                );
                await query(
                    `DELETE FROM public.workspace_recognition_budgets WHERE workspace_id = $1 AND user_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
                await query(
                    `DELETE FROM public.workspace_recognition_period_aggregates WHERE workspace_id = $1 AND user_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
                await query(
                    `DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
                await query(
                    `DELETE FROM public.users WHERE id = ANY($1::uuid[]);`,
                    [createdUserIds]
                );
                console.log(`  Cleaned up ${createdUserIds.length} ephemeral test users and related records.`);
            } catch (cleanupErr: any) {
                console.warn("  Cleanup warning:", cleanupErr.message);
            }
        }
        await pool.end();
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 03 RECOGNITION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================================");

    if (failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runPhase03Tests();
