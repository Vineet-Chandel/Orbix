// Backend/scripts/test_team_workspace_phase_07_redis_leaderboards.ts
import { query } from "../src/database/client.js";
import redis from "../src/redis/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceRecognitionService } from "../src/services/workspace/workspaceRecognitionService.js";
import { WorkspaceRecognitionReconciliationService } from "../src/services/workspace/workspaceRecognitionReconciliationService.js";
import { WorkspaceRecognitionRedisService } from "../src/redis/workspaceRecognitionRedis.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { workspaceEventBus } from "../src/services/workspace/workspaceChannelService.js";

async function runPhase07Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 07 REDIS LEADERBOARDS & REALTIME TESTS");
    console.log("===============================================================================\n");

    const createdUserIds: string[] = [];
    const createdDeptIds: string[] = [];
    let workspaceId = "";
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, msg: string) => {
        if (condition) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    };

    try {
        // 1. Locate Verified Club & Workspace
        const clubRes = await query(`SELECT id, name, auth_user_id FROM public.verified_clubs LIMIT 1;`);
        if (clubRes.rows.length === 0) throw new Error("No verified club found");
        const club = clubRes.rows[0];
        const clubOwnerId = club.auth_user_id;

        const wsRes = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, clubOwnerId);
        workspaceId = wsRes.workspace.id;
        console.log(`Testing with Club: "${club.name}" (Club ID: ${club.id}, Workspace ID: ${workspaceId})\n`);

        // Clean up any stale Redis leaderboard keys for this workspace before starting
        await WorkspaceRecognitionRedisService.clearAllWorkspaceLeaderboards(workspaceId);

        // 2. Setup Test Fixture: Manager & 3 Contributors
        console.log("--- 1. Setting Up Test Fixture (Manager & Contributors) ---");
        const randKey = Math.random().toString(36).slice(2, 7);

        const createTestUser = async (roleTag: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4) RETURNING id;`,
                [`${roleTag}_${randKey}@test.orbix.io`, `${roleTag}_${randKey}`, roleTag.toUpperCase(), "RedisTester"]
            );
            const uid = uRes.rows[0].id;
            createdUserIds.push(uid);
            return uid;
        };

        const mgrUid = await createTestUser("mgr");
        const contrib1Uid = await createTestUser("c1");
        const contrib2Uid = await createTestUser("c2");
        const contrib3Uid = await createTestUser("c3");

        // Fetch workspace roles
        const rolesRes = await query(`SELECT id, name, slug, rank FROM public.workspace_roles WHERE workspace_id = $1;`, [workspaceId]);
        const roles = rolesRes.rows;
        const managerRole = roles.find((r: any) => r.slug === "admin" || r.slug === "manager" || r.rank === 800) || roles[0];
        const memberRole = roles.find((r: any) => r.slug === "member" || r.rank === 200) || roles[roles.length - 1];

        // Create Department
        const dept = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Redis Alpha ${randKey}`,
            slug: `redis_alpha_${randKey}`,
            color: "#6366f1",
        });
        createdDeptIds.push(dept.id);

        // Add workspace members
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: mgrUid,
            roleId: managerRole.id,
            roleTitle: "Workspace Manager",
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib1Uid,
            roleId: memberRole.id,
            roleTitle: "Developer 1",
            departmentId: dept.id,
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib2Uid,
            roleId: memberRole.id,
            roleTitle: "Developer 2",
            departmentId: dept.id,
            membershipStatus: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: contrib3Uid,
            roleId: memberRole.id,
            roleTitle: "Developer 3",
            departmentId: dept.id,
            membershipStatus: "active",
        });

        console.log("  ✅ Test users, roles, and department established.");

        // Recognition Categories & Manager Budget
        let categories = (await query(`SELECT id, slug, name FROM public.workspace_recognition_categories WHERE workspace_id = $1 LIMIT 5;`, [workspaceId])).rows;
        if (categories.length === 0) {
            await WorkspaceRepository.ensureDefaultRecognitionCategories(null, workspaceId);
            categories = (await query(`SELECT id, slug, name FROM public.workspace_recognition_categories WHERE workspace_id = $1;`, [workspaceId])).rows;
        }
        const catTeamwork = categories.find((c: any) => c.slug === "teamwork") || categories[0];

        const periodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        await query(
            `INSERT INTO public.workspace_recognition_budgets (workspace_id, user_id, year_month, allocated_budget, used_budget)
             VALUES ($1, $2, $3, 5000, 0)
             ON CONFLICT (workspace_id, user_id, year_month) DO UPDATE SET allocated_budget = 5000;`,
            [workspaceId, mgrUid, periodKey]
        );

        // 3. Test Concurrent Award Delivery & Outbox Processing
        console.log("\n--- 2. Testing Concurrent Award Delivery & Redis Projection ---");
        // Issue 3 parallel awards concurrently to test atomicity
        const [a1, a2, a3] = await Promise.all([
            WorkspaceRecognitionService.awardOrbits(workspaceId, mgrUid, {
                recipientUserId: contrib1Uid,
                amount: 40,
                categorySlugOrId: catTeamwork.slug,
                reason: "Concurrent award test A",
            }),
            WorkspaceRecognitionService.awardOrbits(workspaceId, mgrUid, {
                recipientUserId: contrib1Uid,
                amount: 35,
                categorySlugOrId: catTeamwork.slug,
                reason: "Concurrent award test B",
            }),
            WorkspaceRecognitionService.awardOrbits(workspaceId, mgrUid, {
                recipientUserId: contrib2Uid,
                amount: 50,
                categorySlugOrId: catTeamwork.slug,
                reason: "Concurrent award test C",
            }),
        ]);

        assert(a1 && a2 && a3, "3 concurrent awards issued successfully");

        // Verify Redis sorted set immediately projected authoritative score (40 + 35 = 75 for c1, 50 for c2)
        const c1Rank = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        const c2Rank = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib2Uid);

        assert(c1Rank.score === 75, `Contributor 1 Redis score accurate after concurrent awards (${c1Rank.score} = 75)`);
        assert(c2Rank.score === 50, `Contributor 2 Redis score accurate after concurrent awards (${c2Rank.score} = 50)`);
        assert(c1Rank.rank === 1, `Contributor 1 holds 1st rank in sorted set (${c1Rank.rank} = 1)`);
        assert(c2Rank.rank === 2, `Contributor 2 holds 2nd rank in sorted set (${c2Rank.rank} = 2)`);

        // 4. Test Duplicate Queue Jobs & Event Idempotency
        console.log("\n--- 3. Testing Duplicate Queue Jobs & Idempotency Safeguards ---");
        // Simulate duplicate processing of award a1 multiple times (e.g. BullMQ retry after worker timeout)
        const duplicateEvent = {
            workspaceId,
            eventType: "recognition:awarded",
            payload: {
                awardId: a1.id,
                recipientId: contrib1Uid,
                amount: 40,
            },
        };

        await WorkspaceRecognitionReconciliationService.processOutboxEvent(duplicateEvent);
        await WorkspaceRecognitionReconciliationService.processOutboxEvent(duplicateEvent);
        await WorkspaceRecognitionReconciliationService.processOutboxEvent(duplicateEvent);

        const c1RankAfterRetries = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        assert(
            c1RankAfterRetries.score === 75,
            `Score remains strictly 75 after 3 duplicate outbox retries (NOT inflated to ${c1RankAfterRetries.score})`
        );

        // 5. Test Nearby Members Retrieval (ZREVRANK & ZREVRANGE)
        console.log("\n--- 4. Testing Nearby Members Ranking Retrieval ---");
        // Award c3 20 points so we have 1st (75), 2nd (50), 3rd (20)
        await WorkspaceRecognitionService.awardOrbits(workspaceId, mgrUid, {
            recipientUserId: contrib3Uid,
            amount: 20,
            categorySlugOrId: catTeamwork.slug,
            reason: "Rank 3 contributor recognized for exceptional execution and teamwork",
        });

        // Query nearby ranks around middle contributor (c2, rank 2) with radius = 1
        const nearbyRes = await WorkspaceRecognitionService.getRedisNearbyRankings(workspaceId, mgrUid, {
            boardType: "contributors",
            period: "this_month",
            targetUserId: contrib2Uid,
            radius: 1,
        });

        assert(nearbyRes.targetRank === 2, `Target rank is 2 (got: ${nearbyRes.targetRank})`);
        assert(nearbyRes.targetScore === 50, `Target score is 50 (got: ${nearbyRes.targetScore})`);
        assert(Array.isArray(nearbyRes.nearby) && nearbyRes.nearby.length === 3, `Nearby window returned 3 members (got: ${nearbyRes.nearby.length})`);
        
        const targetInNearby = nearbyRes.nearby.find((m) => m.entityId === contrib2Uid);
        assert(targetInNearby?.isTarget === true, `Target member explicitly tagged isTarget = true in nearby list`);
        assert(nearbyRes.nearby[0].entityId === contrib1Uid && nearbyRes.nearby[0].rank === 1, `Leader above target is Contributor 1 (rank 1)`);
        assert(nearbyRes.nearby[2].entityId === contrib3Uid && nearbyRes.nearby[2].rank === 3, `Peer below target is Contributor 3 (rank 3)`);

        // 6. Test Redis Restart & Authoritative Rebuild from PostgreSQL
        console.log("\n--- 5. Testing Redis Flushed State & Authoritative Rebuild ---");
        // Completely flush Redis sorted sets to simulate total cache loss / restart
        const deletedKeys = await WorkspaceRecognitionRedisService.clearAllWorkspaceLeaderboards(workspaceId);
        assert(deletedKeys > 0, `Purged ${deletedKeys} Redis leaderboard keys to simulate cold start / restart`);

        // Verify sorted set is now completely empty
        const emptyRank = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        assert(emptyRank.rank === null && emptyRank.score === null, "Redis sorted set confirmed empty");

        // Trigger authoritative rebuild from PostgreSQL
        const rebuildRes = await WorkspaceRecognitionService.rebuildWorkspaceLeaderboards(workspaceId, mgrUid, "this_month");
        assert(rebuildRes.success === true, "Leaderboard rebuild executed successfully");
        assert(rebuildRes.contributorsCount >= 3, `Rebuilt ${rebuildRes.contributorsCount} contributor entries from PostgreSQL`);

        // Verify Redis sorted set rankings and scores are completely restored
        const restoredC1 = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        const restoredC2 = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib2Uid);
        assert(restoredC1.score === 75, `Contributor 1 score restored to 75 in Redis (${restoredC1.score})`);
        assert(restoredC2.score === 50, `Contributor 2 score restored to 50 in Redis (${restoredC2.score})`);
        assert(
            restoredC1.rank !== null && restoredC2.rank !== null && restoredC1.rank < restoredC2.rank,
            `Contributor 1 (75 pts, rank ${restoredC1.rank}) is ranked higher than Contributor 2 (50 pts, rank ${restoredC2.rank})`
        );

        // 7. Test Reversal Propagation to Redis Sorted Sets
        console.log("\n--- 6. Testing Reversal Propagation & Live Score Adjustment ---");
        // Reverse award a2 (35 points from c1)
        await WorkspaceRecognitionService.reverseAward(
            workspaceId,
            mgrUid,
            a2.id,
            { reversalReason: "Test reversal of duplicate award" }
        );

        // Verify c1 score dropped from 75 to 40 (75 - 35 = 40)
        // This causes c2 (50 points) to overtake c1 (40 points) -> dynamic re-ranking!
        const c1AfterReversal = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        const c2AfterReversal = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib2Uid);

        assert(c1AfterReversal.score === 40, `Contributor 1 score reduced to 40 after reversal (got: ${c1AfterReversal.score})`);
        assert(c2AfterReversal.score === 50, `Contributor 2 score remained 50 (got: ${c2AfterReversal.score})`);
        assert(
            c2AfterReversal.rank !== null && c1AfterReversal.rank !== null && c2AfterReversal.rank < c1AfterReversal.rank,
            `Contributor 2 (50 pts, rank ${c2AfterReversal.rank}) dynamically overtook Contributor 1 (40 pts, rank ${c1AfterReversal.rank}) after reversal`
        );

        // 8. Test Periodic Leaderboard Reconciliation
        console.log("\n--- 7. Testing Periodic Reconciliation Engine ---");
        // Introduce an intentional artificial discrepancy in Redis (tampered score)
        const zsetKey = WorkspaceRecognitionRedisService.buildZSetKey(workspaceId, "contributors", "this_month");
        if (redis && redis.status === "ready") {
            await redis.zadd(zsetKey, 99999, contrib1Uid); // Tampered high score
        }

        const tamperedRank = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        assert(tamperedRank.score === 99999, "Artificial discrepancy successfully injected into Redis");

        // Run reconciliation
        const reconcileRes = await WorkspaceRecognitionService.reconcileLeaderboards(workspaceId, mgrUid, "this_month");
        assert(reconcileRes.success === true, "Reconciliation process executed cleanly");
        assert(reconcileRes.discrepanciesFound >= 1, `Reconciliation identified discrepancies (${reconcileRes.discrepanciesFound})`);
        assert(reconcileRes.correctedCount >= 1, `Reconciliation corrected discrepancies (${reconcileRes.correctedCount})`);

        // Verify Redis was healed back to PostgreSQL authoritative score (40)
        const healedRank = await WorkspaceRecognitionRedisService.getEntityRank(workspaceId, "contributors", "this_month", contrib1Uid);
        assert(healedRank.score === 40, `Redis score authoritatively healed to match PostgreSQL (${healedRank.score} = 40)`);

        // 9. Test Real-time Broadcast Event Payload Security (No Private Leaks)
        console.log("\n--- 8. Testing Real-time Event Scoping & Privacy Safeguards ---");
        let capturedEvent: any = null;
        const sseChannel = `workspace:${workspaceId}`;
        const listener = (data: any) => {
            if (data?.event === "recognition:leaderboard_updated") {
                capturedEvent = data;
            }
        };

        workspaceEventBus.on(sseChannel, listener);

        // Process a dummy event
        await WorkspaceRecognitionReconciliationService.processOutboxEvent({
            workspaceId,
            eventType: "recognition:awarded",
            payload: {
                recipientId: contrib3Uid,
                amount: 10,
                reason: "TOP SECRET PRIVATE PERFORMANCE EVALUATION NOTE DO NOT LEAK",
            },
        });

        assert(capturedEvent !== null, "Realtime leaderboard_updated event was broadcast to workspace channel");
        assert(capturedEvent?.payload?.affectedUserId === contrib3Uid, "Event targets correct affected user");
        assert(capturedEvent?.payload?.updatedScore !== undefined, "Event contains updated score");
        assert(
            capturedEvent?.payload?.reason === undefined,
            "Private award reason is strictly excluded from public broadcast payload"
        );
        assert(
            capturedEvent?.payload?.internalBudget === undefined,
            "Manager budget and private metadata are strictly excluded"
        );

        workspaceEventBus.off(sseChannel, listener);

        // 10. Test Security & Access Control (Suspended Member / Cross-Workspace Denial)
        console.log("\n--- 9. Testing Access Control & Cross-Workspace Isolation ---");
        // Suspend contrib3
        await query(`UPDATE public.workspace_members SET is_suspended = true WHERE workspace_id = $1 AND user_id = $2;`, [workspaceId, contrib3Uid]);

        let accessDenied = false;
        try {
            await WorkspaceRecognitionService.getRedisTopRankings(workspaceId, contrib3Uid, {
                boardType: "contributors",
            });
        } catch (err: any) {
            accessDenied = err.message.includes("Unauthorized");
        }
        assert(accessDenied, "Suspended member denied access to Redis leaderboards");

        // Attempt rebuild by ordinary contributor (must be forbidden)
        let rebuildDenied = false;
        try {
            await WorkspaceRecognitionService.rebuildWorkspaceLeaderboards(workspaceId, contrib1Uid, "this_month");
        } catch (err: any) {
            rebuildDenied = err.message.includes("Forbidden");
        }
        assert(rebuildDenied, "Non-manager member forbidden from triggering leaderboard rebuild");

    } catch (err) {
        console.error("Test Suite crashed:", err);
        failed++;
    } finally {
        // 11. Cleanup
        console.log("\n--- 10. Cleaning Up Ephemeral Test Fixtures ---");
        try {
            await WorkspaceRecognitionRedisService.clearAllWorkspaceLeaderboards(workspaceId);
            if (createdUserIds.length > 0) {
                await query(`DELETE FROM public.workspace_recognition_ledger WHERE issuer_id = ANY($1) OR recipient_id = ANY($1);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_recognition_budgets WHERE user_id = ANY($1);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_department_members WHERE user_id = ANY($1);`, [createdUserIds]);
                await query(`DELETE FROM public.workspace_members WHERE user_id = ANY($1);`, [createdUserIds]);
            }
            if (createdDeptIds.length > 0) {
                await query(`DELETE FROM public.workspace_departments WHERE id = ANY($1);`, [createdDeptIds]);
            }
            if (createdUserIds.length > 0) {
                await query(`DELETE FROM public.users WHERE id = ANY($1);`, [createdUserIds]);
            }
            console.log("  ✅ Test fixtures successfully purged from PostgreSQL and Redis.");
        } catch (cleanupErr) {
            console.error("Error during fixture cleanup:", cleanupErr);
        }

        console.log("\n===============================================================================");
        console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
        console.log("===============================================================================\n");
        process.exit(failed > 0 ? 1 : 0);
    }
}

runPhase07Tests();
