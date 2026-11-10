// Backend/scripts/test_team_workspace_phase_04.ts
import crypto from "crypto";
import { query } from "../src/database/client.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceChannelService, workspaceEventBus } from "../src/services/workspace/workspaceChannelService.js";
import redis from "../src/redis/client.js";

async function runPhase04Tests() {
    console.log("=================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 04 ACCEPTANCE & VERIFICATION SUITE");
    console.log("CHANNELS, CATEGORIES, MESSAGING, THREADS & PERMISSIONS");
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

        // Clean previous test channels/categories/messages for a pristine run
        await query(`DELETE FROM public.workspace_messages WHERE workspace_id = $1;`, [workspaceId]);
        await query(`DELETE FROM public.workspace_threads WHERE workspace_id = $1;`, [workspaceId]);
        await query(`DELETE FROM public.workspace_channel_overrides WHERE workspace_id = $1;`, [workspaceId]);
        await query(`DELETE FROM public.workspace_channels WHERE workspace_id = $1;`, [workspaceId]);
        await query(`DELETE FROM public.workspace_channel_categories WHERE workspace_id = $1;`, [workspaceId]);

        // Create 2 test users for permission & isolation testing
        const suffix = Date.now().toString().slice(-6);
        const testUsers: Array<{ id: string; email: string; username: string }> = [];

        for (let i = 1; i <= 3; i++) {
            const uid = crypto.randomUUID();
            const email = `phase04_u${i}_${suffix}@orbix.dev`;
            const username = `p4user${i}_${suffix}`;

            await query(
                `INSERT INTO public.users (id, email, username, firstname, lastname, password, account_type, is_public, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, 'dummy_hash', 'personal', true, NOW(), NOW())
                 ON CONFLICT (id) DO NOTHING;`,
                [uid, email, username, `Test${i}`, `Phase4_${suffix}`]
            );

            testUsers.push({ id: uid, email, username });
        }

        const roles = await WorkspaceRepository.listRoles(workspaceId);
        const adminRole = roles.find((r) => r.slug === "admin")!;
        const memberRole = roles.find((r) => r.slug === "member")!;

        // Add User 1 as Admin, User 2 as normal Member
        const adminMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: testUsers[0].id,
            roleId: adminRole.id,
            roleTitle: "System Admin",
        });

        const normalMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: testUsers[1].id,
            roleId: memberRole.id,
            roleTitle: "Staff Member",
        });

        // Seed 1 department for department-associated categories
        const depts = await WorkspaceDepartmentService.seedSuggestedDepartments(workspaceId, club.auth_user_id);
        const techDept = depts.find((d) => d.slug === "technical-development") || depts[0];

        console.log(`  Initialized test workspace members: Owner, Admin (${adminMember.id}), Member (${normalMember.id})\n`);

        // ---------------------------------------------------------------------
        // TEST SUITE 1: Categories & Department Association
        // ---------------------------------------------------------------------
        console.log("TEST SUITE 1: Distinguish Departments & Channel Categories");

        // 1. Workspace-wide category (department_id IS NULL)
        const clubWideCat = await WorkspaceChannelService.createCategory(
            workspaceId,
            club.auth_user_id,
            { name: "CLUB-WIDE", departmentId: null, isPrivate: false }
        );
        assert("Created workspace-wide channel category", clubWideCat.name === "CLUB-WIDE" && clubWideCat.departmentId === null);

        // 2. Department-associated category (department_id IS NOT NULL)
        const techCat = await WorkspaceChannelService.createCategory(
            workspaceId,
            club.auth_user_id,
            { name: "TECHNICAL & DEVELOPMENT", departmentId: techDept.id, isPrivate: false }
        );
        assert("Created department-associated channel category", techCat.name === "TECHNICAL & DEVELOPMENT" && techCat.departmentId === techDept.id);

        // 3. Update category name
        const updatedCat = await WorkspaceChannelService.updateCategory(
            workspaceId,
            club.auth_user_id,
            clubWideCat.id,
            { name: "GENERAL CLUB-WIDE" }
        );
        assert("Updated category name successfully", updatedCat.name === "GENERAL CLUB-WIDE");

        // ---------------------------------------------------------------------
        // TEST SUITE 2: Channel Types Validation
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 2: Channel Types Architecture (Text, Announcement, Forum, Task Thread)");

        // 1. Text channel
        const textChannel = await WorkspaceChannelService.createChannel(
            workspaceId,
            club.auth_user_id,
            {
                categoryId: clubWideCat.id,
                name: "general",
                channelType: "text",
                topic: "General club conversation",
                isPrivate: false,
            }
        );
        assert("Created Text Channel (#general)", textChannel.channelType === "text" && textChannel.name === "general");

        // 2. Announcement channel
        const announceChannel = await WorkspaceChannelService.createChannel(
            workspaceId,
            club.auth_user_id,
            {
                categoryId: clubWideCat.id,
                name: "announcements",
                channelType: "announcement",
                topic: "Official broadcasts only",
                isPrivate: false,
            }
        );
        assert("Created Announcement Channel (#announcements)", announceChannel.channelType === "announcement");

        // 3. Forum channel
        const forumChannel = await WorkspaceChannelService.createChannel(
            workspaceId,
            club.auth_user_id,
            {
                categoryId: techCat.id,
                departmentId: techDept.id,
                name: "technical-discussions",
                channelType: "forum",
                topic: "Architecture RFCs and discussions",
                isPrivate: false,
            }
        );
        assert("Created Forum Channel (#technical-discussions)", forumChannel.channelType === "forum");

        // 4. Task Discussion channel
        const taskChannel = await WorkspaceChannelService.createChannel(
            workspaceId,
            club.auth_user_id,
            {
                categoryId: techCat.id,
                departmentId: techDept.id,
                name: "sprint-deliverables",
                channelType: "task_discussion",
                topic: "Task progress threads",
                isPrivate: false,
            }
        );
        assert("Created Task Discussion Channel (#sprint-deliverables)", taskChannel.channelType === "task_discussion");

        // ---------------------------------------------------------------------
        // TEST SUITE 3: Discord-Inspired Category Permission Synchronization
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 3: Category Permission Synchronization (Synced, Unsynced, Sync Now, Revert)");

        // By default, textChannel was created with isCategorySynced: true
        assert("Channel created with isCategorySynced: true", textChannel.isCategorySynced === true);

        // Setting a channel-level override flips isCategorySynced to false
        await WorkspaceChannelService.setChannelOverride(
            workspaceId,
            club.auth_user_id,
            textChannel.id,
            {
                roleId: memberRole.id,
                allowPermissions: ["view_channel"],
                denyPermissions: ["send_messages"],
            }
        );

        const unsyncedChannel = await WorkspaceRepository.findChannelById(workspaceId, textChannel.id);
        assert("Channel-level override flips isCategorySynced to false", unsyncedChannel?.isCategorySynced === false);

        // Sync Now / Revert to Category Permissions
        await WorkspaceChannelService.syncChannelWithCategory(
            workspaceId,
            club.auth_user_id,
            textChannel.id
        );

        const resyncedChannel = await WorkspaceRepository.findChannelById(workspaceId, textChannel.id);
        assert("syncChannelWithCategory restores isCategorySynced: true", resyncedChannel?.isCategorySynced === true);

        // Channel move with syncWithNewCategory
        const movedChannel = await WorkspaceChannelService.updateChannel(
            workspaceId,
            club.auth_user_id,
            textChannel.id,
            {
                categoryId: techCat.id,
                syncWithNewCategory: true,
            }
        );
        assert("Moving channel with syncWithNewCategory maintains synced status", movedChannel.categoryId === techCat.id && movedChannel.isCategorySynced === true);

        // ---------------------------------------------------------------------
        // TEST SUITE 4: Strict Private Channel Access Control (ACCEPTANCE CRITERIA)
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 4: Strict Private Channel Security & Anti-Leakage (Acceptance Criteria)");

        // Create Private Category and Channel
        const privateCat = await WorkspaceChannelService.createCategory(
            workspaceId,
            club.auth_user_id,
            { name: "EXECUTIVE SUITE", isPrivate: true }
        );

        const privateChannel = await WorkspaceChannelService.createChannel(
            workspaceId,
            club.auth_user_id,
            {
                categoryId: privateCat.id,
                name: "leadership-confidential",
                channelType: "text",
                topic: "Strictly confidential leadership discussions",
                isPrivate: true,
            }
        );

        // Grant access ONLY to adminRole
        await WorkspaceChannelService.setChannelOverride(
            workspaceId,
            club.auth_user_id,
            privateChannel.id,
            {
                roleId: adminRole.id,
                allowPermissions: ["view_channel", "send_messages"],
            }
        );

        // Seed a confidential message in private channel
        const secretMsg = await WorkspaceChannelService.sendMessage(
            workspaceId,
            club.auth_user_id,
            privateChannel.id,
            { content: "CONFIDENTIAL_FINANCIAL_BUDGET_2026_SECRET_TOKEN" }
        );

        // Seed a thread in private channel
        const secretThread = await WorkspaceChannelService.createThread(
            workspaceId,
            club.auth_user_id,
            privateChannel.id,
            secretMsg.id,
            "Confidential Budget Thread"
        );

        // ACCEPTANCE CRITERION 1: Unauthorized user cannot view channel details
        let leakView = false;
        try {
            await WorkspaceChannelService.getChannelDetails(workspaceId, testUsers[1].id, privateChannel.id);
            leakView = true;
        } catch (err: any) {
            leakView = false;
        }
        assert("AC1: Unauthorized user cannot retrieve private channel metadata (404/denied)", !leakView);

        // ACCEPTANCE CRITERION 2: Unauthorized user cannot list messages even if channel ID is known
        let leakMessages = false;
        try {
            await WorkspaceChannelService.listMessages(workspaceId, testUsers[1].id, privateChannel.id);
            leakMessages = true;
        } catch (err: any) {
            leakMessages = false;
        }
        assert("AC2: Unauthorized user cannot retrieve private channel messages", !leakMessages);

        // ACCEPTANCE CRITERION 3: Unauthorized user cannot post in private channel
        let leakPost = false;
        try {
            await WorkspaceChannelService.sendMessage(workspaceId, testUsers[1].id, privateChannel.id, {
                content: "Hacker injection",
            });
            leakPost = true;
        } catch (err: any) {
            leakPost = false;
        }
        assert("AC3: Unauthorized user cannot post in private channel", !leakPost);

        // ACCEPTANCE CRITERION 4: Unauthorized user cannot retrieve or create threads in private channel
        let leakThread = false;
        try {
            await WorkspaceChannelService.getThread(workspaceId, testUsers[1].id, secretThread.id);
            leakThread = true;
        } catch (err: any) {
            leakThread = false;
        }
        assert("AC4: Unauthorized user cannot retrieve private thread even with thread ID", !leakThread);

        // ACCEPTANCE CRITERION 5: Channel listing excludes private channels for unauthorized user
        const memberVisibleCategories = await WorkspaceChannelService.listCategoriesWithChannels(
            workspaceId,
            testUsers[1].id
        );
        const memberVisibleChannels = memberVisibleCategories.flatMap((c) => c.channels || []);
        const foundPrivateInList = memberVisibleChannels.some((ch) => ch.id === privateChannel.id);
        assert("AC5: Private channel is absent from unauthorized user's categories/channels listing", !foundPrivateInList);

        // ACCEPTANCE CRITERION 6: Message search does not leak private channel messages
        const searchResults = await WorkspaceChannelService.searchMessages(
            workspaceId,
            testUsers[1].id,
            "CONFIDENTIAL_FINANCIAL_BUDGET"
        );
        assert("AC6: Message search excludes messages from private channels for unauthorized user", searchResults.length === 0);

        // Authorized user (admin) CAN access private channel
        const adminCanView = await WorkspaceChannelService.canViewChannel(workspaceId, privateChannel.id, testUsers[0].id);
        assert("Authorized user (Admin) can view private channel", adminCanView === true);

        // ---------------------------------------------------------------------
        // TEST SUITE 5: Messaging, Mentions, Pinned Messages & Reactions
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 5: Messaging Operations, Mentions, Pinned Messages & Emoji Reactions");

        // 1. Create message with mentions in #general
        const generalMsg = await WorkspaceChannelService.sendMessage(
            workspaceId,
            club.auth_user_id,
            textChannel.id,
            {
                content: "Hello @everyone! Welcome to our developer workspace. Please review the docs.",
                messageType: "text",
            }
        );
        assert("Created message with @everyone mention", generalMsg.mentions?.everyone === true);

        // 2. Edit own message
        const editedMsg = await WorkspaceChannelService.editMessage(
            workspaceId,
            club.auth_user_id,
            generalMsg.id,
            "Hello @everyone! Welcome to our developer workspace. (Updated with new guidelines)"
        );
        assert("Edited own message successfully", editedMsg.isEdited === true && editedMsg.content.includes("(Updated with new guidelines)"));

        // 3. Unauthorized edit attempt (User 2 attempts to edit User 1's message)
        let unauthorizedEdit = false;
        try {
            await WorkspaceChannelService.editMessage(
                workspaceId,
                testUsers[1].id,
                generalMsg.id,
                "Malicious edit attempt"
            );
            unauthorizedEdit = true;
        } catch {
            unauthorizedEdit = false;
        }
        assert("Unauthorized user cannot edit another member's message", !unauthorizedEdit);

        // 4. Pin / Unpin message
        const pinned = await WorkspaceChannelService.togglePinMessage(
            workspaceId,
            club.auth_user_id,
            generalMsg.id,
            true
        );
        assert("Pinned message successfully", pinned === true);

        // Member without pin permission cannot pin
        let memberCanPin = false;
        try {
            await WorkspaceChannelService.togglePinMessage(
                workspaceId,
                testUsers[1].id,
                generalMsg.id,
                false
            );
            memberCanPin = true;
        } catch {
            memberCanPin = false;
        }
        assert("Normal member without pin permissions cannot unpin message", !memberCanPin);

        // 5. Emoji Reactions
        // Add reaction 🔥 by User 1
        const rx1 = await WorkspaceChannelService.toggleReaction(
            workspaceId,
            club.auth_user_id,
            generalMsg.id,
            "🔥"
        );
        assert("Added emoji reaction (🔥)", rx1 === true);

        // Add reaction 🔥 by User 2
        const rx2 = await WorkspaceChannelService.toggleReaction(
            workspaceId,
            testUsers[1].id,
            generalMsg.id,
            "🔥"
        );
        assert("Second member added same emoji reaction", rx2 === true);

        // Toggle off reaction by User 1
        const rx3 = await WorkspaceChannelService.toggleReaction(
            workspaceId,
            club.auth_user_id,
            generalMsg.id,
            "🔥"
        );
        assert("Toggling reaction again removes user's reaction", rx3 === false);

        // 6. Announcement Channel Protection
        let memberPostAnnouncement = false;
        try {
            await WorkspaceChannelService.sendMessage(
                workspaceId,
                testUsers[1].id,
                announceChannel.id,
                { content: "Member posting in announcement channel" }
            );
            memberPostAnnouncement = true;
        } catch {
            memberPostAnnouncement = false;
        }
        assert("Non-lead member cannot post in announcement channel", !memberPostAnnouncement);

        // Admin/Owner CAN post in announcement channel
        const adminAnnounce = await WorkspaceChannelService.sendMessage(
            workspaceId,
            club.auth_user_id,
            announceChannel.id,
            { content: "Official chapter announcement broadcast" }
        );
        assert("Owner/Admin successfully posts in announcement channel", !!adminAnnounce.id);

        // 7. Delete message: author deletes own message
        const tempMsg = await WorkspaceChannelService.sendMessage(
            workspaceId,
            testUsers[1].id,
            textChannel.id,
            { content: "Temp message to delete" }
        );
        const deletedOwn = await WorkspaceChannelService.deleteMessage(
            workspaceId,
            testUsers[1].id,
            tempMsg.id
        );
        assert("Author can delete their own message", deletedOwn === true);

        // ---------------------------------------------------------------------
        // TEST SUITE 6: Threads Lifecycle
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 6: Threads Creation, Locking, Archiving & Replies");

        // 1. Create thread from message
        const thread = await WorkspaceChannelService.createThread(
            workspaceId,
            club.auth_user_id,
            textChannel.id,
            generalMsg.id,
            "Q1 Architecture Discussion"
        );
        assert("Created thread linked to parent message", thread.parentMessageId === generalMsg.id && thread.name === "Q1 Architecture Discussion");

        // 2. Post reply in thread
        const reply1 = await WorkspaceChannelService.sendMessage(
            workspaceId,
            testUsers[1].id,
            textChannel.id,
            {
                content: "I propose we use PostgreSQL for permanent storage and Redis for caching.",
                threadId: thread.id,
            }
        );
        assert("Posted reply in thread", reply1.threadId === thread.id);

        // 3. Lock thread
        const lockedThread = await WorkspaceChannelService.updateThread(
            workspaceId,
            club.auth_user_id,
            thread.id,
            { isLocked: true }
        );
        assert("Locked thread successfully", lockedThread.isLocked === true);

        // 4. Posting in locked thread must fail
        let postInLocked = false;
        try {
            await WorkspaceChannelService.sendMessage(
                workspaceId,
                testUsers[1].id,
                textChannel.id,
                { content: "Trying to reply to locked thread", threadId: thread.id }
            );
            postInLocked = true;
        } catch {
            postInLocked = false;
        }
        assert("Posting in locked thread is blocked", !postInLocked);

        // 5. Unlock & Archive thread
        const unlockedThread = await WorkspaceChannelService.updateThread(
            workspaceId,
            club.auth_user_id,
            thread.id,
            { isLocked: false, isArchived: true }
        );
        assert("Unlocked & archived thread", unlockedThread.isLocked === false && unlockedThread.isArchived === true);

        // ---------------------------------------------------------------------
        // TEST SUITE 7: Read Receipts & Unread Tracking
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 7: Read Receipts & Unread Message Counts");

        // New message sent by Owner in #general
        await WorkspaceChannelService.sendMessage(
            workspaceId,
            club.auth_user_id,
            textChannel.id,
            { content: "Unread message check for members" }
        );

        const unreadMapBefore = await WorkspaceChannelService.getUnreadCounts(workspaceId, testUsers[1].id);
        assert("Unread message count is tracked for member", (unreadMapBefore[textChannel.id] || 0) > 0);

        // Mark channel as read
        await WorkspaceChannelService.markChannelRead(workspaceId, testUsers[1].id, textChannel.id);
        const unreadMapAfter = await WorkspaceChannelService.getUnreadCounts(workspaceId, testUsers[1].id);
        assert("Marking channel as read resets unread count to 0", (unreadMapAfter[textChannel.id] || 0) === 0);

        // ---------------------------------------------------------------------
        // TEST SUITE 8: Audit Logging & Real-time Event Bus
        // ---------------------------------------------------------------------
        console.log("\nTEST SUITE 8: Audit Logging & Real-time Event Bus Emission");

        // Check audit logs
        const auditLogs = await query(
            `SELECT action, target_type, target_id FROM public.workspace_audit_logs
             WHERE workspace_id = $1 AND action IN ('channel_category_created', 'channel_created', 'channel_synced_with_category', 'thread_created')
             ORDER BY created_at DESC;`,
            [workspaceId]
        );
        const loggedActions = auditLogs.rows.map((r: any) => r.action);
        assert("Audit log recorded 'channel_category_created'", loggedActions.includes("channel_category_created"));
        assert("Audit log recorded 'channel_created'", loggedActions.includes("channel_created"));
        assert("Audit log recorded 'channel_synced_with_category'", loggedActions.includes("channel_synced_with_category"));
        assert("Audit log recorded 'thread_created'", loggedActions.includes("thread_created"));

        // Event Bus listener test
        let receivedRealtimeEvent = false;
        const testHandler = (data: any) => {
            if (data.event === "message:new") {
                receivedRealtimeEvent = true;
            }
        };
        workspaceEventBus.once(`workspace:${workspaceId}`, testHandler);

        await WorkspaceChannelService.sendMessage(
            workspaceId,
            club.auth_user_id,
            textChannel.id,
            { content: "Realtime SSE broadcast verification" }
        );
        assert("Realtime workspaceEventBus emitted message:new event", receivedRealtimeEvent === true);

        // ---------------------------------------------------------------------
        // FINAL SUMMARY
        // ---------------------------------------------------------------------
        console.log("\n=================================================================");
        console.log(`PHASE 04 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log("=================================================================\n");

        if (failed > 0) {
            process.exit(1);
        } else {
            console.log("🌟 ALL PHASE 04 ACCEPTANCE CRITERIA SUCCESSFULLY VERIFIED!");
            process.exit(0);
        }
    } catch (err: any) {
        console.error("FATAL ERROR IN PHASE 04 TEST SUITE:", err);
        process.exit(1);
    }
}

runPhase04Tests();
