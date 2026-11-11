// Backend/scripts/test_team_workspace_phase_04_recognition.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRedisService } from "../src/redis/workspaceRedis.js";

async function runPhase04Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 04 MEMBER-SIDE RECOGNITION TESTS");
    console.log("===============================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(desc: string, condition: boolean, extra?: any) {
        if (condition) {
            console.log(`  ✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${desc}`);
            if (extra) console.error("    Details:", extra);
            failed++;
        }
    }

    const createdUserIds: string[] = [];
    let wsId: string = "";
    let clubId: string = "";
    let deptId: string = "";

    try {
        // 1. Audit active Club & Workspace
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
        clubId = club.id;
        const ownerId = club.auth_user_id;

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerId);
        wsId = workspace.id;

        console.log(`Auditing Club: "${club.name}" (Club ID: ${clubId}, Workspace ID: ${wsId}, Owner: ${ownerId})`);

        // Get or create department for test
        const deptRes = await query(`
            SELECT id, name FROM public.workspace_departments WHERE workspace_id = $1 LIMIT 1;
        `, [wsId]);
        if (deptRes.rows.length > 0) {
            deptId = deptRes.rows[0].id;
        } else {
            const newDept = await WorkspaceRepository.createDepartment(null, {
                workspaceId: wsId,
                name: "Technical Operations",
                slug: "technical-ops",
                color: "#4f46e5",
            });
            deptId = newDept.id;
        }

        // Fetch hierarchy roles
        const rolesRes = await query(`
            SELECT id, slug, rank FROM public.workspace_roles WHERE workspace_id = $1;
        `, [wsId]);
        const roles = rolesRes.rows;
        const mgrRole = roles.find((r: any) => r.slug === "manager" || r.rank === 800) || roles[0];
        const leadRole = roles.find((r: any) => r.slug === "department_lead" || r.rank === 600) || roles[0];
        const memberRole = roles.find((r: any) => r.slug === "member" || r.rank === 200) || roles[0];

        // 2. Set Up Test Members
        console.log("\n--- 1. Setting Up Test Hierarchy (Manager, Dept Lead, 2 Members) ---");
        const randKey = Math.random().toString(36).slice(2, 7);

        // A. Workspace Manager
        const mgrEmail = `mgr_${randKey}@orbix.io`;
        const mgrUserRes = await query(`
            INSERT INTO public.users (email, username, firstname, lastname)
            VALUES ($1, $2, 'Morgan', 'Manager')
            RETURNING id;
        `, [mgrEmail, `mgr_${randKey}`]);
        const mgrUser = mgrUserRes.rows[0];
        createdUserIds.push(mgrUser.id);

        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: mgrUser.id,
            roleId: mgrRole.id,
            departmentId: deptId,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        // Set as workspace manager in team_workspaces
        await query(`UPDATE public.team_workspaces SET manager_user_id = $1 WHERE id = $2;`, [mgrUser.id, wsId]);

        // Allocate budget to Manager
        await WorkspaceRecognitionService.allocateManagerBudget(wsId, ownerId, mgrUser.id, 500);

        // B. Department Lead
        const leadEmail = `lead_${randKey}@orbix.io`;
        const leadUserRes = await query(`
            INSERT INTO public.users (email, username, firstname, lastname)
            VALUES ($1, $2, 'Leo', 'Lead')
            RETURNING id;
        `, [leadEmail, `lead_${randKey}`]);
        const leadUser = leadUserRes.rows[0];
        createdUserIds.push(leadUser.id);

        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: leadUser.id,
            roleId: leadRole.id,
            departmentId: deptId,
            roleTitle: "Lead Developer",
            membershipStatus: "active",
        });

        // Set as lead in department
        await query(`UPDATE public.workspace_departments SET lead_user_id = $1 WHERE id = $2;`, [leadUser.id, deptId]);

        // C. Member A (Primary Recipient)
        const memAEmail = `memA_${randKey}@orbix.io`;
        const memAUserRes = await query(`
            INSERT INTO public.users (email, username, firstname, lastname)
            VALUES ($1, $2, 'Alice', 'Engineer')
            RETURNING id;
        `, [memAEmail, `alice_${randKey}`]);
        const memAUser = memAUserRes.rows[0];
        createdUserIds.push(memAUser.id);

        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: memAUser.id,
            roleId: memberRole.id,
            departmentId: deptId,
            roleTitle: "Frontend Engineer",
            membershipStatus: "active",
        });

        // D. Member B (Peer Member)
        const memBEmail = `memB_${randKey}@orbix.io`;
        const memBUserRes = await query(`
            INSERT INTO public.users (email, username, firstname, lastname)
            VALUES ($1, $2, 'Bob', 'Tester')
            RETURNING id;
        `, [memBEmail, `bob_${randKey}`]);
        const memBUser = memBUserRes.rows[0];
        createdUserIds.push(memBUser.id);

        await WorkspaceRepository.createMember(null, {
            workspaceId: wsId,
            userId: memBUser.id,
            roleId: memberRole.id,
            departmentId: deptId,
            roleTitle: "QA Engineer",
            membershipStatus: "active",
        });

        console.log("  Hierarchy members created and assigned to Department successfully.");

        // =========================================================================
        // TEST 1: Member sees their own recognition summary & recent awards
        // =========================================================================
        console.log("\n--- 2. Test 1: Member sees their own recognition summary ---");

        // Issue a public award to Alice (+25 Orbits)
        const award1 = await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: memAUser.id,
            amount: 25,
            categorySlugOrId: "teamwork",
            reason: "Outstanding support during frontend architecture refactoring.",
            visibility: "workspace",
        });

        // Issue another public award to Alice (+15 Orbits)
        const award2 = await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
            recipientUserId: memAUser.id,
            amount: 15,
            categorySlugOrId: "leadership",
            reason: "Proactively organized technical documentation sprint.",
            visibility: "workspace",
        });

        const aliceSummary = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, memAUser.id);
        assert("Alice total Orbits earned is 40", aliceSummary.totalOrbitsEarned === 40);
        assert("Alice monthly Orbits earned is 40", aliceSummary.monthlyOrbitsEarned === 40);
        assert("Alice weekly Orbits earned is 40", aliceSummary.weeklyOrbitsEarned === 40);
        assert("Alice awards received count is 2", aliceSummary.awardsReceivedCount === 2);
        assert("Alice contributor rank is calculated", aliceSummary.contributorRank !== null && aliceSummary.contributorRank !== undefined);
        assert("Alice recent awards array populated", aliceSummary.recentAwards.length === 2);

        // =========================================================================
        // TEST 2: Member sees workspace-visible awards when allowed
        // =========================================================================
        console.log("\n--- 3. Test 2: Member sees workspace-visible awards ---");

        const bobLedgerView = await WorkspaceRecognitionService.getLedgerHistory(wsId, memBUser.id, { limit: 10 });
        const canBobSeeAward1 = bobLedgerView.entries.some((e: any) => e.id === award1.id);
        const canBobSeeAward2 = bobLedgerView.entries.some((e: any) => e.id === award2.id);

        assert("Peer Bob can see Alice's workspace-visible award 1", canBobSeeAward1);
        assert("Peer Bob can see Alice's workspace-visible award 2", canBobSeeAward2);

        // =========================================================================
        // TEST 3: Recipient-only awards remain private from peer ledger queries
        // =========================================================================
        console.log("\n--- 4. Test 3: Recipient-only awards remain private ---");

        // Issue a recipient-only private award to Alice (+30 Orbits)
        const privateAward = await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: memAUser.id,
            amount: 30,
            categorySlugOrId: "reliability",
            reason: "Private appreciation for handling critical incident over weekend.",
            visibility: "recipient_only",
        });
        assert("Private award created with recipient_only visibility", privateAward.visibility === "recipient_only");

        // Query ledger as Bob (peer member)
        const bobLedgerAfterPrivate = await WorkspaceRecognitionService.getLedgerHistory(wsId, memBUser.id, { limit: 20 });
        const canBobSeePrivateAward = bobLedgerAfterPrivate.entries.some((e: any) => e.id === privateAward.id);
        assert("Peer Bob CANNOT see Alice's recipient_only private award in ledger history", !canBobSeePrivateAward);

        // Query ledger as Alice (the recipient)
        const aliceLedger = await WorkspaceRecognitionService.getLedgerHistory(wsId, memAUser.id, { limit: 20 });
        const canAliceSeeOwnPrivateAward = aliceLedger.entries.some((e: any) => e.id === privateAward.id);
        assert("Recipient Alice CAN see her own recipient_only private award in ledger history", canAliceSeeOwnPrivateAward);

        // =========================================================================
        // TEST 4: Direct ID manipulation blocked for private awards
        // =========================================================================
        console.log("\n--- 5. Test 4: Direct ID manipulation blocked for private awards ---");

        // A. Bob tries to fetch private award by manipulating ID
        let bobDirectLookupBlocked = false;
        try {
            await WorkspaceRecognitionService.getAwardById(wsId, memBUser.id, privateAward.id);
        } catch (err: any) {
            bobDirectLookupBlocked = err.message.includes("Access denied: This recognition award is private.");
        }
        assert("Bob direct ID lookup of private award is BLOCKED (403/Forbidden)", bobDirectLookupBlocked);

        // B. Alice (Recipient) can fetch it directly
        const aliceDirectLookup = await WorkspaceRecognitionService.getAwardById(wsId, memAUser.id, privateAward.id);
        assert("Alice (Recipient) can fetch private award by ID", !!aliceDirectLookup && aliceDirectLookup.id === privateAward.id);

        // C. Morgan (Issuer) can fetch it directly
        const mgrDirectLookup = await WorkspaceRecognitionService.getAwardById(wsId, mgrUser.id, privateAward.id);
        assert("Morgan (Issuer) can fetch private award by ID", !!mgrDirectLookup && mgrDirectLookup.id === privateAward.id);

        // D. Club Owner (Supreme authority) can fetch it directly
        const ownerDirectLookup = await WorkspaceRecognitionService.getAwardById(wsId, ownerId, privateAward.id);
        assert("Club Owner can fetch private award by ID", !!ownerDirectLookup && ownerDirectLookup.id === privateAward.id);

        // =========================================================================
        // TEST 5: Reversed awards representation & correction references
        // =========================================================================
        console.log("\n--- 6. Test 5: Reversed awards representation & correction references ---");

        // Reverse Award 2 (issued by Owner)
        const reversalResult = await WorkspaceRecognitionService.reverseAward(wsId, ownerId, award2.id, {
            reversalReason: "Issued under duplicate testing condition.",
        });

        assert("Original award status marked as 'reversed'", reversalResult.originalEntry.status === "reversed");
        assert("Original award isReversed is true", reversalResult.originalEntry.isReversed === true);
        assert("Original award reversalReason preserved", reversalResult.originalEntry.reversalReason === "Issued under duplicate testing condition.");

        assert("Compensating reversal transaction type is 'reversal'", reversalResult.reversalEntry.transactionType === "reversal");
        assert("Compensating pointsDelta is negative (-15)", reversalResult.reversalEntry.pointsDelta === -15);
        assert("Compensating referenceAwardId points to original award", reversalResult.reversalEntry.referenceAwardId === award2.id);

        // Verify Alice's balance correctly adjusted without row deletion
        const aliceSummaryAfterReversal = await WorkspaceRecognitionService.getMyRecognitionSummary(wsId, memAUser.id);
        // Original: 25 + 15 + 30 = 70. Reversed 15 => 55.
        assert("Alice balance adjusted to 55 Orbits after compensating reversal", aliceSummaryAfterReversal.totalOrbitsEarned === 55);

        // =========================================================================
        // TEST 6: Department recognition summary & rankings
        // =========================================================================
        console.log("\n--- 7. Test 6: Department recognition summary & rankings ---");

        // Award Bob some points (+20)
        await WorkspaceRecognitionService.awardOrbits(wsId, mgrUser.id, {
            recipientUserId: memBUser.id,
            amount: 20,
            categorySlugOrId: "problem_solving",
            reason: "Consistently identifying edge case regressions.",
            visibility: "workspace",
        });

        // Award Lead Leo some points (+50)
        await WorkspaceRecognitionService.awardOrbits(wsId, ownerId, {
            recipientUserId: leadUser.id,
            amount: 50,
            categorySlugOrId: "creativity",
            reason: "Designed high performance caching layer.",
            visibility: "workspace",
        });

        // Department Summary query by Lead Leo
        const deptSummary = await WorkspaceRecognitionService.getDepartmentRecognition(wsId, leadUser.id, deptId);
        assert("Department name matches", deptSummary.departmentName === "Technical Operations");
        assert("Active member count is at least 4 (Manager, Lead, Alice, Bob)", deptSummary.activeMemberCount >= 4);
        assert("Department total Orbits is positive", deptSummary.totalOrbits > 0);
        assert("Average Orbits per member calculated", deptSummary.averageOrbitsPerMember > 0);
        assert("Member rankings populated", deptSummary.memberRankings.length >= 4);

        // Verify rankings order (Highest points first)
        const rank1 = deptSummary.memberRankings[0];
        const rank2 = deptSummary.memberRankings[1];
        assert("Rank 1 has greater or equal points than Rank 2", rank1.totalOrbits >= rank2.totalOrbits);
        assert("Rank 1 has rank number 1", rank1.rank === 1);

        // =========================================================================
        // TEST 7: Member recognition profile & appreciation notes
        // =========================================================================
        console.log("\n--- 8. Test 7: Member profile & manager appreciation notes ---");

        // A. Member profile lookup
        const aliceProfile = await WorkspaceRecognitionService.getMemberRecognitionProfile(wsId, memBUser.id, memAUser.id);
        assert("Alice profile returned with name and username", aliceProfile.username === `alice_${randKey}`);
        assert("Alice profile role title matches", aliceProfile.roleTitle === "Frontend Engineer");
        assert("Alice total orbits matches ledger (55)", aliceProfile.totalOrbitsEarned === 55);
        // Bob viewing Alice: private award should be filtered out from recent awards
        const hasPrivateInProfileForPeer = aliceProfile.recentAwards.some((a: any) => a.id === privateAward.id);
        assert("Private award is filtered out when peer views member profile", !hasPrivateInProfileForPeer);

        // B. Manager adds an appreciation note to Award 1
        const noteRecord = await WorkspaceRecognitionService.addAppreciationNote(
            wsId,
            mgrUser.id,
            award1.id,
            "Special thanks from management: this unblocked the mobile release!"
        );
        assert("Appreciation note created with author and note content", !!noteRecord.id && noteRecord.note.includes("unblocked the mobile release"));

        // C. Retrieve notes for Award 1
        const awardNotes = await WorkspaceRecognitionService.getAwardNotes(wsId, memAUser.id, award1.id);
        assert("Award notes list contains the added note", awardNotes.length >= 1 && awardNotes[0].note.includes("unblocked the mobile release"));

    } catch (error: any) {
        console.error("FATAL ERROR during Phase 04 Recognition Test execution:", error);
        failed++;
    } finally {
        // Ephemeral test fixture cleanup
        console.log("\n--- 9. Ephemeral Fixture Cleanup ---");
        if (createdUserIds.length > 0 && wsId) {
            try {
                await query(
                    `DELETE FROM public.workspace_recognition_notes WHERE workspace_id = $1 AND author_id = ANY($2::uuid[]);`,
                    [wsId, createdUserIds]
                );
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
                    `DELETE FROM public.workspace_notifications WHERE workspace_id = $1 AND (recipient_id = ANY($2::uuid[]) OR actor_id = ANY($2::uuid[]));`,
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
    }

    console.log("\n===============================================================================");
    console.log(`PHASE 04 RECOGNITION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================================\n");

    if (failed > 0) process.exit(1);
    process.exit(0);
}

runPhase04Tests();
