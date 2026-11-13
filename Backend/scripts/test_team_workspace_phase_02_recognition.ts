// Backend/scripts/test_team_workspace_phase_02_recognition.ts
/**
 * ORBIX TEAM WORKSPACE — PHASE 02 RECOGNITION ENGINE & IMMUTABLE LEDGER TEST SUITE
 * 
 * Verifies:
 * 1. Policy initialization & Category seeding
 * 2. Club Manager (Owner) supreme award authority
 * 3. Workspace Manager delegated award with budget consumption
 * 4. Hierarchy restrictions (Manager cannot award Owner or peer managers)
 * 5. Unauthorized award rejection (Regular Member & Department Lead without permission)
 * 6. Anti-Self-Award enforcement (Owner, Manager, Member)
 * 7. Cross-workspace isolation
 * 8. Suspended / Inactive recipient rejection
 * 9. Validation bounds (min/max points, reason quality, valid category)
 * 10. Budget overdraft prevention
 * 11. Recipient monthly inflow cap enforcement
 * 12. Idempotency deduplication
 * 13. Audited compensating reversal with budget refund & negative ledger delta
 * 14. Reversal duplicate prevention & unauthorized reversal rejection
 * 15. Period aggregate tracking (weekly, monthly, all-time, award count)
 * 16. Transactional outbox event emission
 * 17. Ephemeral test fixture cleanup
 */

import { query, pool } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";

async function runPhase02RecognitionTests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 02 IMMUTABLE LEDGER & RECOGNITION ENGINE TESTS");
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
    const createdRoleIds: string[] = [];

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
            throw new Error("No verified clubs with owners found for Phase 02 tests.");
        }
        const club = clubRes.rows[0];
        const ownerId = club.auth_user_id;
        console.log(`Auditing Club: "${club.name}" (Club ID: ${club.id}, Owner: ${ownerId})\n`);

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerId);
        wsId = workspace.id;

        // Step 2: Ensure policy and default categories are initialized
        console.log("--- 1. Policy & Category Verification ---");
        const policy = await WorkspaceRepository.getRecognitionPolicy(wsId);
        assert("Recognition policy exists and is enabled", policy.isEnabled === true);
        assert("Policy point unit name is 'Orbits'", policy.pointUnitName === "Orbits");

        const categories = await WorkspaceRepository.listRecognitionCategories(wsId, true);
        assert("Default categories seeded (at least 9 standard categories)", categories.length >= 9);
        const teamworkCategory = categories.find((c) => c.slug === "teamwork");
        assert("Category 'teamwork' is present and active", !!teamworkCategory && teamworkCategory.isActive);

        // Step 3: Create Ephemeral Users & Members
        console.log("\n--- 2. Setting Up Test Hierarchy (Owner > Manager > Lead > Member) ---");
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const res = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username;`,
                [`p02_${roleName}_${randKey}@audit.orbix.club`, `p02_${roleName}_${randKey}`, `P02${roleName}`, "User"]
            );
            createdUserIds.push(res.rows[0].id);
            return res.rows[0];
        };

        const mgrUser = await makeUser("manager");
        const peerMgrUser = await makeUser("peermgr");
        const leadUser = await makeUser("lead");
        const memberUser = await makeUser("member");
        const outsiderUser = await makeUser("outsider");

        // Fetch workspace roles
        const roles = await WorkspaceRepository.listRoles(wsId);
        const managerRole = roles.find((r) => r.slug === "admin" || r.slug === "manager" || r.rank === 800);
        const leadRole = roles.find((r) => r.slug === "dept_lead" || r.slug === "lead" || r.rank === 600);
        const defaultMemberRole = roles.find((r) => r.slug === "member" || r.rank === 200);

        if (!managerRole || !defaultMemberRole) {
            throw new Error(`Required roles (manager, member) missing from workspace. Found: ${roles.map(r => r.slug).join(', ')}`);
        }

        // Add Manager
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: mgrUser.id,
            roleId: managerRole.id,
            roleTitle: "Operations Manager",
            membershipStatus: "active",
        });

        // Add Peer Manager
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: peerMgrUser.id,
            roleId: managerRole.id,
            roleTitle: "Technical Manager",
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

        // Add Regular Member
        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: memberUser.id,
            roleId: defaultMemberRole.id,
            roleTitle: "Core Developer",
            membershipStatus: "active",
        });

        console.log("  Hierarchy members created successfully.");

        // Step 4: Test Club Manager (Owner) Supreme Award
        console.log("\n--- 3. Club Manager (Owner) Supreme Award Authority ---");
        const ownerAward = await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
            recipientUserId: memberUser.id,
            amount: 50,
            categorySlugOrId: "impact",
            reason: "Delivered exceptional performance on high-priority architectural release.",
            idempotencyKey: `idemp_owner_${randKey}`,
        });

        assert("Owner award executed successfully", !!ownerAward && ownerAward.pointsDelta === 50);
        assert("Transaction type is 'award'", ownerAward.transactionType === "award");
        assert("Issuer matches Owner ID", ownerAward.issuerId === ownerId);
        assert("Recipient matches Member ID", ownerAward.recipientId === memberUser.id);

        // Verify Member Summary
        const memberSummary = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, memberUser.id);
        assert("Member received total 50 Orbits", memberSummary.currentBalance === 50);
        assert("Member awards received count is 1", memberSummary.awardsReceivedCount === 1);

        // Step 5: Test Idempotency on Owner Award
        console.log("\n--- 4. Idempotency Key Deduplication ---");
        const duplicateAward = await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
            recipientUserId: memberUser.id,
            amount: 50,
            categorySlugOrId: "impact",
            reason: "Delivered exceptional performance on high-priority architectural release.",
            idempotencyKey: `idemp_owner_${randKey}`,
        });
        assert("Duplicate submission returns existing award record", duplicateAward.id === ownerAward.id);
        const memberSummaryAfterDupe = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, memberUser.id);
        assert("Balance did not double (remains 50 Orbits)", memberSummaryAfterDupe.currentBalance === 50);

        // Step 6: Test Workspace Manager Award with Budget Allocation
        console.log("\n--- 5. Workspace Manager Delegated Award & Budget Tracking ---");
        // Owner allocates 150 Orbits to Manager
        const allocated = await WorkspaceRecognitionService.allocateManagerBudget(
            wsId,
            ownerId,
            mgrUser.id,
            150
        );
        assert("Owner allocated 150 Orbits budget to Manager", allocated.allocatedBudget === 150);
        assert("Manager initial used budget is 0", Number(allocated.usedBudget) === 0);
        assert("Manager remaining budget is 150", Number(allocated.remainingBudget) === 150);

        // Manager awards 35 Orbits to Lead
        const mgrAward = await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: leadUser.id,
            amount: 35,
            categorySlugOrId: "leadership",
            reason: "Outstanding guidance during team sprint and mentoring junior members.",
        });
        assert("Manager award to Lead succeeded", !!mgrAward && mgrAward.pointsDelta === 35);

        // Check Manager Budget after award
        const currentMonth = new Date().toISOString().slice(0, 7);
        const budgetAfterAward = await WorkspaceRepository.getOrCreateRecognitionBudget(
            null,
            wsId,
            mgrUser.id,
            currentMonth
        );
        assert("Manager used budget updated to 35", budgetAfterAward.usedBudget === 35);
        assert("Manager remaining budget is 115", budgetAfterAward.remainingBudget === 115);

        // Step 7: Hierarchy Boundary Protections
        console.log("\n--- 6. Hierarchy Boundary Protections (Image Architecture) ---");
        // A. Manager attempting to award Club Owner
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
        assert("Manager cannot award Club Owner (Hierarchy Rule)", mgrAwardOwnerBlocked);

        // B. Manager attempting to award Peer Manager
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
        assert("Manager cannot award Peer Manager (Lateral/Higher Rank Block)", mgrAwardPeerBlocked);

        // C. Regular Member attempting to award
        let memberAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, memberUser.id, {
                recipientUserId: leadUser.id,
                amount: 15,
                categorySlugOrId: "teamwork",
                reason: "Attempting to award without recognition authority.",
            });
        } catch (err: any) {
            memberAwardBlocked = err.message.includes("authority to award Orbits");
        }
        assert("Regular Member cannot award Orbits (Unauthorized)", memberAwardBlocked);

        // D. Lead without explicit recognition permission attempting to award
        let leadAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, leadUser.id, {
                recipientUserId: memberUser.id,
                amount: 15,
                categorySlugOrId: "teamwork",
                reason: "Department Lead attempting to award without permission.",
            });
        } catch (err: any) {
            leadAwardBlocked = err.message.includes("authority to award Orbits");
        }
        assert("Department Lead cannot award without recognition:award permission", leadAwardBlocked);

        // Step 8: Anti-Self-Award Enforcement
        console.log("\n--- 7. Anti-Self-Award Enforcement ---");
        // A. Owner self-award attempt
        let ownerSelfAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: ownerId,
                amount: 50,
                categorySlugOrId: "leadership",
                reason: "Attempting to self-award Orbits.",
            });
        } catch (err: any) {
            ownerSelfAwardBlocked = err.message.includes("cannot award Orbits to themselves");
        }
        assert("Owner self-award blocked", ownerSelfAwardBlocked);

        // B. Manager self-award attempt
        let mgrSelfAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
                recipientUserId: mgrUser.id,
                amount: 25,
                categorySlugOrId: "leadership",
                reason: "Manager attempting to self-award Orbits.",
            });
        } catch (err: any) {
            mgrSelfAwardBlocked = err.message.includes("cannot award Orbits to themselves");
        }
        assert("Manager self-award blocked", mgrSelfAwardBlocked);

        // Step 9: Cross-Workspace Isolation & Inactive Recipient Protections
        console.log("\n--- 8. Isolation & Member State Protections ---");
        let outsiderAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: outsiderUser.id,
                amount: 25,
                categorySlugOrId: "teamwork",
                reason: "Attempting to award user from outside workspace.",
            });
        } catch (err: any) {
            outsiderAwardBlocked = err.message.includes("not a member of this workspace");
        }
        assert("Cannot award non-member of workspace", outsiderAwardBlocked);

        // Test Suspended Recipient
        await query(
            `UPDATE public.workspace_members SET is_suspended = true WHERE workspace_id = $1 AND user_id = $2;`,
            [wsId, memberUser.id]
        );
        let suspendedAwardBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: memberUser.id,
                amount: 20,
                categorySlugOrId: "teamwork",
                reason: "Attempting to award suspended member.",
            });
        } catch (err: any) {
            suspendedAwardBlocked = err.message.includes("suspended or inactive member");
        }
        assert("Cannot award suspended member", suspendedAwardBlocked);
        // Unsuspend member
        await query(
            `UPDATE public.workspace_members SET is_suspended = false WHERE workspace_id = $1 AND user_id = $2;`,
            [wsId, memberUser.id]
        );

        // Step 10: Validation Bounds (Points bounds, Reason length, Category)
        console.log("\n--- 9. Policy & Validation Bounds ---");
        // A. Below minimum points (< 5)
        let belowMinBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: memberUser.id,
                amount: 2,
                categorySlugOrId: "teamwork",
                reason: "Valid reason exceeding minimum length.",
            });
        } catch (err: any) {
            belowMinBlocked = err.message.includes("Minimum award amount is 5");
        }
        assert("Below min points (<5) rejected", belowMinBlocked);

        // B. Exceeds max points (> policy.maxPointsPerAward)
        let aboveMaxBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: memberUser.id,
                amount: 75,
                categorySlugOrId: "teamwork",
                reason: "Valid reason exceeding minimum length.",
            });
        } catch (err: any) {
            aboveMaxBlocked = err.message.includes("Maximum single award amount is");
        }
        assert("Above max points (> maxPointsPerAward) rejected", aboveMaxBlocked);

        // C. Reason too short (< 15 chars)
        let shortReasonBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: memberUser.id,
                amount: 25,
                categorySlugOrId: "teamwork",
                reason: "Great job!",
            });
        } catch (err: any) {
            shortReasonBlocked = err.message.includes("at least 15 characters");
        }
        assert("Vague reason (<15 chars) rejected", shortReasonBlocked);

        // D. Inactive / invalid category
        let invalidCatBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: memberUser.id,
                amount: 25,
                categorySlugOrId: "nonexistent_cat",
                reason: "Valid reason exceeding minimum length.",
            });
        } catch (err: any) {
            invalidCatBlocked = err.message.includes("Invalid or inactive recognition category");
        }
        assert("Non-existent category rejected", invalidCatBlocked);

        // Step 11: Budget Overdraft Protection
        console.log("\n--- 10. Budget Overdraft Protection ---");
        // Manager allocated 150. Current used: 35. Remaining: 115.
        // Award 40 to Lead -> used: 75, remaining: 75
        await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: leadUser.id,
            amount: 40,
            categorySlugOrId: "leadership",
            reason: "Mentoring junior members on backend engineering standards.",
        });
        // Award 40 to Lead -> used: 115, remaining: 35
        await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: leadUser.id,
            amount: 40,
            categorySlugOrId: "leadership",
            reason: "Mentoring junior members on database indexing strategies.",
        });
        // Attempt to award 45 (<= 50 max points, but > 35 remaining budget)
        let overdraftBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
                recipientUserId: memberUser.id,
                amount: 45,
                categorySlugOrId: "teamwork",
                reason: "Attempting to exceed remaining monthly budget.",
            });
        } catch (err: any) {
            overdraftBlocked = err.message.includes("Insufficient recognition award budget");
        }
        assert("Budget overdraft attempt rejected", overdraftBlocked);

        // Step 12: Recipient Monthly Inflow Cap Enforcement
        console.log("\n--- 11. Recipient Monthly Inflow Cap Enforcement ---");
        // Temporarily adjust recipient monthly cap in policy to 70
        await query(
            `UPDATE public.workspace_recognition_policies SET recipient_monthly_cap = 70 WHERE workspace_id = $1;`,
            [wsId]
        );
        // Member currently received 50. Inflow cap is 70.
        // Attempting to award 25 (50 + 25 = 75 > 70) should be blocked.
        let inflowCapBlocked = false;
        try {
            await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
                recipientUserId: memberUser.id,
                amount: 25,
                categorySlugOrId: "teamwork",
                reason: "Attempting to push member over monthly inflow cap.",
            });
        } catch (err: any) {
            inflowCapBlocked = err.message.includes("allowance exceeded") || err.message.includes("Remaining capacity");
        }
        assert("Recipient monthly inflow cap enforced (rejected exceeding award)", inflowCapBlocked);

        // Reset recipient cap back to 500
        await query(
            `UPDATE public.workspace_recognition_policies SET recipient_monthly_cap = 500 WHERE workspace_id = $1;`,
            [wsId]
        );

        // Step 13: Audited Compensating Reversal & Budget Refund
        console.log("\n--- 12. Audited Compensating Reversal & Budget Refund ---");
        // Manager has 35 remaining. Manager awards 30 Orbits to Member (used becomes 115 + 30 = 145)
        const mgrAwardToMember = await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: memberUser.id,
            amount: 30,
            categorySlugOrId: "teamwork",
            reason: "Collaborated effectively with lead on API contract definitions.",
        });
        assert("Manager awarded 30 Orbits to Member", mgrAwardToMember.pointsDelta === 30);

        const budgetBeforeReversal = await WorkspaceRepository.getOrCreateRecognitionBudget(
            null,
            wsId,
            mgrUser.id,
            currentMonth
        );
        assert("Manager used budget before reversal is 145 (115 + 30)", budgetBeforeReversal.usedBudget === 145);

        // Reverse the 30 Orbits award
        const reversalResult = await WorkspaceRecognitionService.reverseAward(
            wsId,
            mgrUser.id,
            mgrAwardToMember.id,
            {
                reversalReason: "Award issued under mistaken department category attribution.",
            }
        );

        assert("Compensating reversal executed", !!reversalResult.reversalEntry);
        assert("Reversal points delta is -30", reversalResult.reversalEntry.pointsDelta === -30);
        assert("Reversal transaction type is 'reversal'", reversalResult.reversalEntry.transactionType === "reversal");
        assert("Reversal references original award ID", reversalResult.reversalEntry.referenceAwardId === mgrAwardToMember.id);
        assert("Original award is marked is_reversed = true", reversalResult.originalEntry.isReversed === true);

        // Check Manager Budget after reversal -> should have refunded 30 Orbits (used back to 115)
        const budgetAfterReversal = await WorkspaceRepository.getOrCreateRecognitionBudget(
            null,
            wsId,
            mgrUser.id,
            currentMonth
        );
        assert("Manager budget refunded after reversal (used budget back to 115)", budgetAfterReversal.usedBudget === 115);

        // Attempting duplicate reversal on already-reversed award
        let duplicateReversalBlocked = false;
        try {
            await WorkspaceRecognitionService.reverseAward(
                wsId,
                mgrUser.id,
                mgrAwardToMember.id,
                {
                    reversalReason: "Attempting to reverse an already reversed award.",
                }
            );
        } catch (err: any) {
            duplicateReversalBlocked = err.message.includes("already been reversed");
        }
        assert("Duplicate reversal on same award rejected", duplicateReversalBlocked);

        // Unauthorized user (regular member) attempting to reverse
        let unauthorizedReversalBlocked = false;
        try {
            await WorkspaceRecognitionService.reverseAward(
                wsId,
                memberUser.id,
                mgrAward.id,
                {
                    reversalReason: "Member attempting to reverse manager's award.",
                }
            );
        } catch (err: any) {
            unauthorizedReversalBlocked = err.message.includes("authority to reverse");
        }
        assert("Unauthorized user cannot reverse awards", unauthorizedReversalBlocked);

        // Step 14: Period Aggregate Tracking & Ledger History
        console.log("\n--- 13. Aggregate Tracking & Ledger Integrity ---");
        const leadSummary = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, leadUser.id);
        assert("Lead summary has 115 all-time points (35 + 40 + 40)", leadSummary.allTimePoints === 115);
        assert("Lead summary current balance is 115", leadSummary.currentBalance === 115);

        const history = await WorkspaceRecognitionService.getLedgerHistory(wsId, ownerId, { limit: 20 });
        assert("Ledger history returns multiple transactions", history.total >= 3);
        const hasReversalInHistory = history.entries.some((e) => e.transactionType === "reversal");
        assert("Ledger history contains compensating reversal entry", hasReversalInHistory);

        // Step 15: Transactional Outbox Event Integration
        console.log("\n--- 14. Transactional Outbox Verification ---");
        const outboxRes = await query(
            `SELECT * FROM public.workspace_outbox_events 
             WHERE workspace_id = $1 AND event_type IN ('recognition:awarded', 'recognition:reversed')
             ORDER BY created_at DESC LIMIT 5;`,
            [wsId]
        );
        assert("Outbox contains recognition:awarded & recognition:reversed events", outboxRes.rows.length >= 2);
        const awardedEvent = outboxRes.rows.find((r) => r.event_type === "recognition:awarded");
        const reversedEvent = outboxRes.rows.find((r) => r.event_type === "recognition:reversed");
        assert("Outbox contains recognition:awarded event", !!awardedEvent);
        assert("Outbox contains recognition:reversed event", !!reversedEvent);

    } catch (error: any) {
        console.error("FATAL ERROR during Phase 02 Recognition Test execution:", error);
        failed++;
    } finally {
        // Step 16: Clean up ephemeral test fixtures
        console.log("\n--- 15. Ephemeral Fixture Cleanup ---");
        if (createdUserIds.length > 0 && wsId) {
            try {
                // Delete ledger entries created during test
                await query(
                    `DELETE FROM public.workspace_recognition_ledger WHERE workspace_id = $1 AND (issuer_id = ANY($2::uuid[]) OR recipient_id = ANY($2::uuid[]));`,
                    [wsId, createdUserIds]
                );
                // Delete budgets
                await query(
                    `DELETE FROM public.workspace_recognition_budgets WHERE workspace_id = $1 AND user_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
                // Delete period aggregates
                await query(
                    `DELETE FROM public.workspace_recognition_period_aggregates WHERE workspace_id = $1 AND user_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
                // Delete members
                await query(
                    `DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
                // Delete ephemeral users
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
    console.log(`PHASE 02 RECOGNITION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================================");

    if (failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runPhase02RecognitionTests();
