// Backend/scripts/test_team_workspace_phase_04.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceChannelService } from "../src/services/workspace/workspaceChannelService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";

async function runPhase04Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 04 CHANNELS & REALTIME COLLABORATION TEST SUITE");
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
        // 1. SETUP
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

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(
            club.id,
            club.auth_user_id
        );
        const workspaceId = workspace.id;

        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const deptLeadRole = roles.find((r) => r.slug === "dept_lead")!;
        const memberRole = roles.find((r) => r.slug === "member")!;

        // Generate isolated test personas
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p4_${roleName}_${randKey}@test.orbix.club`,
                    `p4_${roleName}_${randKey}`,
                    `P4${roleName}`,
                    `Test`,
                ]
            );
            return uRes.rows[0];
        };

        const leadUser = await makeUser("lead");
        const memberA = await makeUser("mem_a");
        const memberB = await makeUser("mem_b");

        // Create 2 test departments
        const dept1 = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            club.auth_user_id,
            { name: `Engineering P4 ${randKey}`, color: "#4F46E5" }
        );
        const dept2 = await WorkspaceDepartmentService.createDepartment(
            workspaceId,
            club.auth_user_id,
            { name: `Design P4 ${randKey}`, color: "#EC4899" }
        );

        const addMemberRecord = async (userId: string, roleId: string) => {
            const res = await query(
                `INSERT INTO public.workspace_members (workspace_id, user_id, role_id, role_title)
                 VALUES ($1, $2, $3, 'Test Member')
                 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = $3
                 RETURNING id;`,
                [workspaceId, userId, roleId]
            );
            return res.rows[0];
        };

        // Add leadUser to Dept1 as lead
        const leadMember = await addMemberRecord(leadUser.id, deptLeadRole.id);
        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept1.id,
            leadMember.id,
            "lead",
            "Tech Lead"
        );

        // Add memberA to Dept1 as member
        const memAMember = await addMemberRecord(memberA.id, memberRole.id);
        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept1.id,
            memAMember.id,
            "member"
        );

        // Add memberB to Dept2 as member
        const memBMember = await addMemberRecord(memberB.id, memberRole.id);
        await WorkspaceDepartmentService.addMemberToDepartment(
            workspaceId,
            club.auth_user_id,
            dept2.id,
            memBMember.id,
            "member"
        );

        // =====================================================================
        // PART 1: CHANNEL CATEGORIES MANAGEMENT & REORDERING
        // =====================================================================
        console.log("PART 1: Channel Categories Management & Reordering");

        // Lead can create category for assigned department
        const cat1 = await WorkspaceChannelService.createCategory(workspaceId, leadUser.id, {
            name: `TECH TEAM ${randKey}`,
            departmentId: dept1.id,
        });
        assert("Department Lead can create category for their assigned department", !!cat1 && cat1.name === `TECH TEAM ${randKey}`);

        // Lead cannot create category for another department
        let leadOtherCatError = false;
        try {
            await WorkspaceChannelService.createCategory(workspaceId, leadUser.id, {
                name: `DESIGN TEAM ${randKey}`,
                departmentId: dept2.id,
            });
        } catch (e) {
            leadOtherCatError = true;
        }
        assert("Department Lead CANNOT create category for another department", leadOtherCatError);

        // Manager creates second category
        const cat2 = await WorkspaceChannelService.createCategory(workspaceId, club.auth_user_id, {
            name: `GENERAL CHAT ${randKey}`,
        });
        assert("Workspace Manager can create chapter-wide category", !!cat2);

        // Reorder categories
        const reorderSuccess = await WorkspaceChannelService.reorderCategories(workspaceId, club.auth_user_id, [
            cat2.id,
            cat1.id,
        ]);
        assert("Authorized user can reorder categories", reorderSuccess);

        const categoriesPostReorder = await WorkspaceRepository.listCategories(workspaceId);
        const cat2FromDb = categoriesPostReorder.find((c) => c.id === cat2.id);
        const cat1FromDb = categoriesPostReorder.find((c) => c.id === cat1.id);
        assert(
            "Category 2 has lower display_order than Category 1 after reorder",
            !!cat2FromDb && !!cat1FromDb && (cat2FromDb.displayOrder ?? 0) < (cat1FromDb.displayOrder ?? 0)
        );

        // Update category
        const updatedCat = await WorkspaceChannelService.updateCategory(workspaceId, leadUser.id, cat1.id, {
            name: `TECH CORE ${randKey}`,
        });
        assert("Department Lead can update their department category name", updatedCat.name === `TECH CORE ${randKey}`);

        // =====================================================================
        // PART 2: CHANNELS OF ALL TYPES & REORDERING
        // =====================================================================
        console.log("\nPART 2: Channels of All Types & Operations");

        // Text channel
        const chText = await WorkspaceChannelService.createChannel(workspaceId, leadUser.id, {
            name: `code-talk-${randKey}`,
            channelType: "text",
            categoryId: cat1.id,
            departmentId: dept1.id,
        });
        assert("Created text channel", !!chText && chText.channelType === "text");

        // Announcement channel
        const chAnnounce = await WorkspaceChannelService.createChannel(workspaceId, leadUser.id, {
            name: `eng-broadcasts-${randKey}`,
            channelType: "announcement",
            categoryId: cat1.id,
            departmentId: dept1.id,
        });
        assert("Created announcement channel", !!chAnnounce && chAnnounce.channelType === "announcement");

        // Forum channel
        const chForum = await WorkspaceChannelService.createChannel(workspaceId, club.auth_user_id, {
            name: `ideas-forum-${randKey}`,
            channelType: "forum",
            categoryId: cat2.id,
        });
        assert("Created forum channel", !!chForum && chForum.channelType === "forum");

        // Task discussion channel
        const chTaskDisc = await WorkspaceChannelService.createChannel(workspaceId, club.auth_user_id, {
            name: `sprint-sync-${randKey}`,
            channelType: "task_discussion",
            categoryId: cat2.id,
        });
        assert("Created task_discussion channel", !!chTaskDisc && chTaskDisc.channelType === "task_discussion");

        // Reorder channels
        const chanReorderSuccess = await WorkspaceChannelService.reorderChannels(workspaceId, club.auth_user_id, [
            chAnnounce.id,
            chText.id,
        ]);
        assert("Authorized user can reorder channels", chanReorderSuccess);

        // Update channel topic & slowmode
        const updatedChan = await WorkspaceChannelService.updateChannel(workspaceId, leadUser.id, chText.id, {
            topic: "Architecture reviews and code snippets",
            defaultSlowmodeSeconds: 10,
        });
        assert("Updated channel topic and slowmode", updatedChan.topic === "Architecture reviews and code snippets" && updatedChan.defaultSlowmodeSeconds === 10);

        // =====================================================================
        // PART 3: PRIVATE CHANNEL SECURITY & ANTI-LEAKAGE
        // =====================================================================
        console.log("\nPART 3: Private Channel Security & Anti-Leakage");

        const chPrivate = await WorkspaceChannelService.createChannel(workspaceId, club.auth_user_id, {
            name: `secret-leads-${randKey}`,
            channelType: "private",
            isPrivate: true,
            allowedRoleIds: [deptLeadRole.id],
        });
        assert("Created private channel", !!chPrivate && chPrivate.isPrivate === true);

        // Lead has deptLeadRole -> can view
        const leadCanView = await WorkspaceChannelService.canViewChannel(workspaceId, chPrivate.id, leadUser.id);
        assert("Lead with authorized role CAN view private channel", leadCanView === true);

        // MemberA and MemberB lack authorized role -> CANNOT view
        const memACanView = await WorkspaceChannelService.canViewChannel(workspaceId, chPrivate.id, memberA.id);
        assert("Unauthorized MemberA CANNOT view private channel", memACanView === false);

        // Unauthorized user getChannelDetails throws
        let getDetailsDenied = false;
        try {
            await WorkspaceChannelService.getChannelDetails(workspaceId, memberA.id, chPrivate.id);
        } catch (e) {
            getDetailsDenied = true;
        }
        assert("Unauthorized user receives 404/Error when requesting channel details directly", getDetailsDenied);

        // Unauthorized user listMessages throws
        let listMessagesDenied = false;
        try {
            await WorkspaceChannelService.listMessages(workspaceId, memberA.id, chPrivate.id);
        } catch (e) {
            listMessagesDenied = true;
        }
        assert("Unauthorized user receives 404/Error when requesting channel messages", listMessagesDenied);

        // Post message in private channel
        await WorkspaceChannelService.sendMessage(workspaceId, leadUser.id, chPrivate.id, {
            content: `CONFIDENTIAL: Project Apollo roadmap v${randKey}`,
        });

        // Search messages by unauthorized user must NOT reveal confidential message
        const searchResults = await WorkspaceChannelService.searchMessages(workspaceId, memberA.id, `Project Apollo roadmap v${randKey}`);
        assert("Message search does NOT leak confidential private channel messages", searchResults.length === 0);

        // listCategories for MemberA does NOT include private channel
        const catsForMemberA = await WorkspaceChannelService.listCategories(workspaceId, memberA.id);
        const allChansForA = catsForMemberA.flatMap((c) => c.channels || []);
        assert("Private channel is excluded from unauthorized user category channel list", !allChansForA.some((c) => c.id === chPrivate.id));

        // =====================================================================
        // PART 4: CHANNEL PERMISSION OVERRIDES (ROLE & MEMBER)
        // =====================================================================
        console.log("\nPART 4: Channel Permission Overrides");

        // Explicit member override: Grant MemberA access to private channel
        const memOverride = await WorkspaceChannelService.setChannelOverride(workspaceId, club.auth_user_id, chPrivate.id, {
            memberId: memAMember.id,
            allowPermissions: ["view_channel", "send_messages"],
        });
        assert("Configured explicit member allow override", !!memOverride);

        const memACanViewNow = await WorkspaceChannelService.canViewChannel(workspaceId, chPrivate.id, memberA.id);
        assert("MemberA CAN view private channel after explicit override grant", memACanViewNow === true);

        // Delete override
        const overrideDeleted = await WorkspaceChannelService.deleteOverride(workspaceId, club.auth_user_id, chPrivate.id, memOverride.id);
        assert("Deleted channel override", overrideDeleted === true);

        const memACanViewAfterDelete = await WorkspaceChannelService.canViewChannel(workspaceId, chPrivate.id, memberA.id);
        assert("MemberA access revoked after override deletion", memACanViewAfterDelete === false);

        // =====================================================================
        // PART 5: MESSAGING, MENTIONS, EDIT, DELETE & PINNING
        // =====================================================================
        console.log("\nPART 5: Messaging, Mentions, Pinned, and Reactions");

        // Send message with mentions
        const msg1 = await WorkspaceChannelService.sendMessage(workspaceId, leadUser.id, chText.id, {
            content: `Hey @${memberA.username} and @dept-lead please check the build!`,
        });
        assert("Sent message with @mentions", !!msg1);
        assert("Mentions parsed correctly", (msg1.mentions?.users || []).includes(memberA.username.toLowerCase()));

        // Edit own message
        const editedMsg = await WorkspaceChannelService.editMessage(workspaceId, leadUser.id, msg1.id, "Hey team, build is live!");
        assert("Author can edit own message", editedMsg.content === "Hey team, build is live!" && editedMsg.isEdited === true);

        // Other user cannot edit message
        let otherEditFailed = false;
        try {
            await WorkspaceChannelService.editMessage(workspaceId, memberA.id, msg1.id, "Malicious edit");
        } catch (e) {
            otherEditFailed = true;
        }
        assert("Non-author CANNOT edit someone else's message", otherEditFailed);

        // Non-moderator cannot delete another's message
        let otherDeleteFailed = false;
        try {
            await WorkspaceChannelService.deleteMessage(workspaceId, memberA.id, msg1.id);
        } catch (e) {
            otherDeleteFailed = true;
        }
        assert("Regular member CANNOT delete someone else's message", otherDeleteFailed);

        // Pin message
        const pinnedSuccess = await WorkspaceChannelService.togglePinMessage(workspaceId, leadUser.id, msg1.id, true);
        assert("Authorized user can pin message", pinnedSuccess === true);

        // Emoji reaction
        const reactionAdded = await WorkspaceChannelService.toggleReaction(workspaceId, memberA.id, msg1.id, "🚀");
        assert("Member can add emoji reaction", reactionAdded === true);

        const reactionRemoved = await WorkspaceChannelService.toggleReaction(workspaceId, memberA.id, msg1.id, "🚀");
        assert("Toggling same emoji reaction removes it", reactionRemoved === false);

        // =====================================================================
        // PART 6: THREADS & MODERATION
        // =====================================================================
        console.log("\nPART 6: Threads & Moderation");

        // Create thread
        const thread = await WorkspaceChannelService.createThread(workspaceId, leadUser.id, chText.id, msg1.id, "Apollo Release Thread");
        assert("Created thread from parent message", !!thread && thread.name === "Apollo Release Thread");

        // Reply in thread
        const threadReply = await WorkspaceChannelService.sendMessage(workspaceId, memberA.id, chText.id, {
            content: "Deployed successfully to staging cluster.",
            threadId: thread.id,
        });
        assert("Posted reply in thread", !!threadReply && threadReply.threadId === thread.id);

        const fetchedThread = await WorkspaceChannelService.getThread(workspaceId, leadUser.id, thread.id);
        assert("Thread message count updated", fetchedThread.messageCount >= 1);

        // Lock thread
        const lockedThread = await WorkspaceChannelService.updateThread(workspaceId, leadUser.id, thread.id, {
            isLocked: true,
        });
        assert("Lead can lock thread", lockedThread.isLocked === true);

        // Regular member cannot post in locked thread
        let lockedPostFailed = false;
        try {
            await WorkspaceChannelService.sendMessage(workspaceId, memberA.id, chText.id, {
                content: "Attempting to post in locked thread",
                threadId: thread.id,
            });
        } catch (e) {
            lockedPostFailed = true;
        }
        assert("Regular member CANNOT post in locked thread", lockedPostFailed);

        // Archive thread
        const archivedThread = await WorkspaceChannelService.updateThread(workspaceId, leadUser.id, thread.id, {
            isArchived: true,
        });
        assert("Lead can archive thread", archivedThread.isArchived === true);

        // Cleanup test data
        await query(`DELETE FROM public.workspace_threads WHERE channel_id IN ($1, $2, $3, $4, $5);`, [chText.id, chAnnounce.id, chForum.id, chTaskDisc.id, chPrivate.id]);
        await query(`DELETE FROM public.workspace_messages WHERE channel_id IN ($1, $2, $3, $4, $5);`, [chText.id, chAnnounce.id, chForum.id, chTaskDisc.id, chPrivate.id]);
        await query(`DELETE FROM public.workspace_channels WHERE id IN ($1, $2, $3, $4, $5);`, [chText.id, chAnnounce.id, chForum.id, chTaskDisc.id, chPrivate.id]);
        await query(`DELETE FROM public.workspace_channel_categories WHERE id IN ($1, $2);`, [cat1.id, cat2.id]);
        await query(`DELETE FROM public.workspace_department_members WHERE department_id IN ($1, $2);`, [dept1.id, dept2.id]);
        await query(`DELETE FROM public.workspace_departments WHERE id IN ($1, $2);`, [dept1.id, dept2.id]);
        await query(`DELETE FROM public.workspace_members WHERE user_id IN ($1, $2, $3);`, [leadUser.id, memberA.id, memberB.id]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUser.id, memberA.id, memberB.id]);

    } catch (err: any) {
        console.error("FATAL SUITE ERROR:", err);
        failed++;
    } finally {
        console.log("\n===============================================================================");
        console.log(`PHASE 04 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log("===============================================================================\n");
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runPhase04Tests();
