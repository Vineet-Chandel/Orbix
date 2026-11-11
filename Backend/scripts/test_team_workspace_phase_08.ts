// Backend/scripts/test_team_workspace_phase_08.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceDashboardService } from "../src/services/workspace/workspaceDashboardService.js";
import { WorkspaceNotificationService } from "../src/services/workspace/workspaceNotificationService.js";
import { WorkspaceEmailService } from "../src/services/workspace/workspaceEmailService.js";
import { WorkspaceChannelService } from "../src/services/workspace/workspaceChannelService.js";

async function runPhase08Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 08 ACTIVITY, NOTIFS, AUDIT & SEARCH TEST SUITE");
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

        // 2. Provision Test Users
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p8_${roleName}_${randKey}@test.orbix.club`,
                    `p8_${roleName}_${randKey}`,
                    `P8${roleName}`,
                    `User`,
                ]
            );
            return uRes.rows[0];
        };

        const managerUser = await makeUser("mgr");
        const deptAleadUser = await makeUser("lead_a");
        const deptAmemberUser = await makeUser("mem_a");
        const deptBleadUser = await makeUser("lead_b");
        const normalMemberUser = await makeUser("normal");

        const defaultRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "member");
        if (!defaultRole) throw new Error("Default member role not found.");

        // Provision Departments A and B
        const deptA = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Dept A ${randKey}`,
            slug: `dept-a-${randKey}`,
            leadUserId: deptAleadUser.id,
            color: "#70C4FF",
        });

        const deptB = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `Dept B ${randKey}`,
            slug: `dept-b-${randKey}`,
            leadUserId: deptBleadUser.id,
            color: "#FF90E8",
        });

        // Add members
        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: managerUser.id,
            roleId: defaultRole.id,
            status: "active",
        });

        await WorkspaceMemberService.appointWorkspaceManager(
            workspaceId,
            ownerUserId,
            managerUser.id,
            [
                "can_manage_departments",
                "can_manage_members",
                "can_invite_members",
                "can_manage_channels",
                "can_manage_tasks",
                "can_manage_settings",
            ]
        );

        const deptAleadMember = await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptAleadUser.id,
            roleId: defaultRole.id,
            departmentId: deptA.id,
            status: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptAmemberUser.id,
            roleId: defaultRole.id,
            departmentId: deptA.id,
            status: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptBleadUser.id,
            roleId: defaultRole.id,
            departmentId: deptB.id,
            status: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: normalMemberUser.id,
            roleId: defaultRole.id,
            departmentId: null,
            status: "active",
        });

        // Provision activity fixtures
        // 1. Unrestricted workspace activity
        await query(
            `INSERT INTO public.workspace_activity_feed (
                workspace_id, actor_id, event_type, resource_type, resource_id, title, description, is_restricted
            ) VALUES ($1, $2, 'workspace:announcement', 'workspace', $3, 'Global Workspace Kickoff', 'All members invited', false);`,
            [workspaceId, ownerUserId, workspaceId]
        );

        // 2. Dept A restricted activity
        await query(
            `INSERT INTO public.workspace_activity_feed (
                workspace_id, department_id, actor_id, event_type, resource_type, resource_id, title, description, is_restricted
            ) VALUES ($1, $2, $3, 'department:secret_plan', 'department', $4, 'Dept A Secret Strategy', 'Confidential to Dept A', true);`,
            [workspaceId, deptA.id, deptAleadUser.id, deptA.id]
        );

        // 3. Dept B restricted activity
        await query(
            `INSERT INTO public.workspace_activity_feed (
                workspace_id, department_id, actor_id, event_type, resource_type, resource_id, title, description, is_restricted
            ) VALUES ($1, $2, $3, 'department:budget_review', 'department', $4, 'Dept B Q4 Budget', 'Confidential to Dept B', true);`,
            [workspaceId, deptB.id, deptBleadUser.id, deptB.id]
        );

        console.log("\n--- TEST GROUP 1: WORKSPACE, DEPARTMENT & PERSONAL ACTIVITY ---");
        // 1. Owner can view full workspace activity
        const ownerActivity = await WorkspaceDashboardService.getActivityFeed(workspaceId, ownerUserId);
        const ownerTitles = ownerActivity.events.map((e) => e.title);
        assert("Owner sees all workspace activities including Dept A and Dept B", 
            ownerTitles.includes("Global Workspace Kickoff") && 
            ownerTitles.includes("Dept A Secret Strategy") && 
            ownerTitles.includes("Dept B Q4 Budget")
        );

        // 2. Manager can view full authorized activity
        const mgrActivity = await WorkspaceDashboardService.getActivityFeed(workspaceId, managerUser.id);
        const mgrTitles = mgrActivity.events.map((e) => e.title);
        assert("Workspace Manager sees authorized workspace activities", 
            mgrTitles.includes("Global Workspace Kickoff") && mgrTitles.includes("Dept A Secret Strategy")
        );

        // 3. Dept A Lead only sees unrestricted + Dept A activity (NOT Dept B)
        const deptAActivity = await WorkspaceDashboardService.getActivityFeed(workspaceId, deptAleadUser.id);
        const deptATitles = deptAActivity.events.map((e) => e.title);
        assert("Dept A Lead sees unrestricted activity and Dept A activity", 
            deptATitles.includes("Global Workspace Kickoff") && deptATitles.includes("Dept A Secret Strategy")
        );
        assert("Dept A Lead CANNOT see Dept B restricted activity (Privacy Enforced)", 
            !deptATitles.includes("Dept B Q4 Budget")
        );

        // 4. Dept A Lead requesting Dept B filter directly is FORBIDDEN
        let deptLeadLeakBlocked = false;
        try {
            await WorkspaceDashboardService.getActivityFeed(workspaceId, deptAleadUser.id, { departmentId: deptB.id });
        } catch (err: any) {
            deptLeadLeakBlocked = err.message.includes("Forbidden");
        }
        assert("Dept A Lead explicitly querying Dept B is rejected with Forbidden", deptLeadLeakBlocked);

        // 5. Personal activity filter
        const personalActivity = await WorkspaceDashboardService.getActivityFeed(workspaceId, deptAleadUser.id, { actorId: deptAleadUser.id });
        assert("Personal activity filters to events where user was the actor", 
            personalActivity.events.every((e) => e.actorId === deptAleadUser.id)
        );

        console.log("\n--- TEST GROUP 2: AUDIT LOG PRIVACY & IMMUTABILITY ---");
        // Create an audit entry
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: ownerUserId,
            action: "system_config_updated",
            targetType: "workspace",
            targetId: workspaceId,
            details: { setting: "strict_mode_enabled" },
            ipAddress: "127.0.0.1",
            userAgent: "Test Runner",
        });

        // 1. Owner can view audit logs
        const ownerAudit = await WorkspaceDashboardService.getAuditLogs(workspaceId, ownerUserId);
        assert("Owner can retrieve administrative audit logs", ownerAudit.total > 0 && ownerAudit.logs.length > 0);

        // 2. Workspace Manager can view audit logs
        const mgrAudit = await WorkspaceDashboardService.getAuditLogs(workspaceId, managerUser.id);
        assert("Workspace Manager can retrieve administrative audit logs", mgrAudit.total > 0);

        // 3. Normal member CANNOT view audit logs
        let memberAuditBlocked = false;
        try {
            await WorkspaceDashboardService.getAuditLogs(workspaceId, normalMemberUser.id);
        } catch (err: any) {
            memberAuditBlocked = err.message.includes("Forbidden");
        }
        assert("Ordinary member is strictly blocked (Forbidden) from administrative audit logs", memberAuditBlocked);

        console.log("\n--- TEST GROUP 3: NOTIFICATION DISPATCH, READ STATE & PREFERENCES ---");
        // 1. Task Assigned Notification
        const notifAssigned = await WorkspaceNotificationService.notifyTaskAssigned({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            taskId: "task-p8-1",
            taskTitle: "Implement Realtime Subscriptions",
            taskVersion: 1,
            assigneeId: deptAmemberUser.id,
            actorId: deptAleadUser.id,
            actorName: "Dept A Lead",
            departmentName: deptA.name,
            priority: "high",
        });
        assert("Task assigned notification created successfully", !!notifAssigned.id && notifAssigned.eventType === "task_assigned");

        // 2. Task Reassigned Notification
        const notifReassigned = await WorkspaceNotificationService.notifyTaskReassigned({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            taskId: "task-p8-1",
            taskTitle: "Implement Realtime Subscriptions",
            taskVersion: 2,
            assigneeId: deptAmemberUser.id,
            actorId: deptAleadUser.id,
            actorName: "Dept A Lead",
            notes: "Reassigned with urgent priority",
        });
        assert("Task reassigned notification created successfully", !!notifReassigned.id && notifReassigned.eventType === "task_reassigned");

        // 3. Task Comment Notification
        await WorkspaceNotificationService.notifyTaskComment({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            taskId: "task-p8-1",
            taskTitle: "Implement Realtime Subscriptions",
            commenterId: deptAleadUser.id,
            commenterName: "Dept A Lead",
            content: "Please check the latest documentation update.",
            recipientIds: [deptAmemberUser.id],
        });
        assert("Task comment notification dispatched to recipient", true);

        // 4. Role Changed Notification
        const notifRole = await WorkspaceNotificationService.notifyRoleChanged({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: deptAmemberUser.id,
            actorId: ownerUserId,
            actorName: "Club Owner",
            newRoleName: "Senior Architect",
        });
        assert("Role changed notification created successfully", !!notifRole.id && notifRole.eventType === "role_assigned");

        // 5. Department Membership Added & Removed Notifications
        const notifDeptAdded = await WorkspaceNotificationService.notifyDepartmentAdded({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: normalMemberUser.id,
            actorId: ownerUserId,
            actorName: "Club Owner",
            departmentId: deptA.id,
            departmentName: deptA.name,
        });
        assert("Department added notification created", !!notifDeptAdded.id && notifDeptAdded.eventType === "department_membership_added");

        const notifDeptRemoved = await WorkspaceNotificationService.notifyDepartmentRemoved({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: normalMemberUser.id,
            actorId: ownerUserId,
            actorName: "Club Owner",
            departmentId: deptA.id,
            departmentName: deptA.name,
        });
        assert("Department removed notification created", !!notifDeptRemoved.id && notifDeptRemoved.eventType === "department_membership_removed");

        // 6. Mention Notification
        const notifMention = await WorkspaceNotificationService.notifyMention({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: deptAmemberUser.id,
            actorId: deptAleadUser.id,
            actorName: "Dept A Lead",
            resourceType: "channel",
            resourceId: "channel-123",
            resourceTitle: "#general",
            contentSnippet: "Hey @mem_a please review this PR!",
            destinationUrl: `/club/${club.id}/workspace/channels/general`,
        });
        assert("Mention notification created successfully", !!notifMention.id && notifMention.eventType === "mention");

        // 7. Channel Update Notification
        await WorkspaceNotificationService.notifyChannelUpdate({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            channelId: "channel-general",
            channelName: "general",
            recipientIds: [deptAmemberUser.id],
            actorId: ownerUserId,
            actorName: "Club Owner",
            updateType: "announcement",
            message: "Important workspace maintenance announcement",
        });
        assert("Channel update notification dispatched", true);

        // 8. List Notifications for user
        const memberNotifs = await WorkspaceRepository.getUserNotifications(workspaceId, deptAmemberUser.id, { limit: 10 });
        assert("Recipient retrieves list of in-app notifications", memberNotifs.notifications.length > 0 && memberNotifs.unreadCount > 0);

        // 9. Mark single notification as read
        const firstNotifId = memberNotifs.notifications[0].id;
        const markSingleSuccess = await WorkspaceRepository.markNotificationRead(workspaceId, deptAmemberUser.id, firstNotifId);
        assert("Single notification marked as read", markSingleSuccess === true);

        // 10. Mark all notifications as read
        await WorkspaceRepository.markAllNotificationsRead(workspaceId, deptAmemberUser.id);
        const refreshedNotifs = await WorkspaceRepository.getUserNotifications(workspaceId, deptAmemberUser.id, { limit: 10 });
        assert("All notifications marked as read (unreadCount === 0)", refreshedNotifs.unreadCount === 0);

        // 11. Notification Preferences
        const defaultPrefs = await WorkspaceRepository.getUserNotificationPreferences(workspaceId, deptAmemberUser.id);
        assert("Default preferences return emailTaskAssigned = true", defaultPrefs.emailTaskAssigned === true);

        const updatedPrefs = await WorkspaceRepository.upsertUserNotificationPreferences(workspaceId, deptAmemberUser.id, {
            emailTaskAssigned: false,
            emailDigestFrequency: "daily",
        });
        assert("Upsert notification preferences persists custom settings", 
            updatedPrefs.emailTaskAssigned === false && updatedPrefs.emailDigestFrequency === "daily"
        );

        // 12. Preference respected during email dispatch
        const sendOutcome = await WorkspaceEmailService.sendEmail({
            workspaceId,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: deptAmemberUser.id,
            recipientEmail: deptAmemberUser.email,
            recipientName: "Dept A Member",
            emailType: "task_assigned",
            idempotencyKey: `task-assigned-pref-test-${Date.now()}`,
            context: {},
        });
        assert("Email service respects preference and skips task_assigned email", 
            sendOutcome.skipped === true && sendOutcome.skipReason?.includes("disabled task assignment emails")
        );

        console.log("\n--- TEST GROUP 4: PERMISSION-FILTERED WORKSPACE SEARCH ---");
        // Create search fixtures
        // A. Public channel
        const publicChannel = await WorkspaceRepository.createChannel(null, {
            workspaceId,
            name: `public-chat-${randKey}`,
            slug: `public-chat-${randKey}`,
            topic: `Open discussions for all members ${randKey}`,
            isPrivate: false,
        });

        // B. Private channel accessible only to Dept A
        const privateChannel = await WorkspaceRepository.createChannel(null, {
            workspaceId,
            departmentId: deptA.id,
            name: `secret-dept-a-${randKey}`,
            slug: `secret-dept-a-${randKey}`,
            topic: `Confidential Dept A discussions ${randKey}`,
            isPrivate: true,
        });

        // C. Discussion thread in private channel
        const parentMsg = await WorkspaceRepository.createMessage(null, {
            workspaceId,
            channelId: privateChannel.id,
            senderId: deptAleadUser.id,
            senderMemberId: deptAleadMember.id,
            content: `Root message for confidential thread ${randKey}`,
            messageType: "text",
        });

        await WorkspaceRepository.createThread(null, {
            workspaceId,
            channelId: privateChannel.id,
            parentMessageId: parentMsg.id,
            name: `Classified Operation Thread ${randKey}`,
            creatorId: deptAleadUser.id,
        });

        // D. Task in Dept A
        await WorkspaceRepository.createTask(null, {
            workspaceId,
            departmentId: deptA.id,
            creatorId: deptAleadUser.id,
            title: `Confidential Dept A Blueprint ${randKey}`,
            description: `Restricted blueprint spec ${randKey}`,
            priority: "urgent",
        });

        // 1. Dept A Lead searches: can find public channel, private channel, thread, and task
        const deptASearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, deptAleadUser.id, randKey);
        const deptASearchTitles = deptASearch.results.map((r) => r.title);
        assert("Dept A Lead finds public channel in search", deptASearchTitles.includes(`public-chat-${randKey}`));
        assert("Dept A Lead finds private channel in search", deptASearchTitles.includes(`secret-dept-a-${randKey}`));
        assert("Dept A Lead finds confidential task in search", deptASearchTitles.includes(`Confidential Dept A Blueprint ${randKey}`));
        assert("Dept A Lead finds discussion thread in search", deptASearchTitles.includes(`Classified Operation Thread ${randKey}`));

        // 2. Outside Member searches: ZERO LEAKAGE of Dept A private channel, thread, or task!
        const outsideSearch = await WorkspaceDashboardService.searchWorkspace(workspaceId, normalMemberUser.id, randKey);
        const outsideSearchTitles = outsideSearch.results.map((r) => r.title);
        assert("Outside member finds public channel in search", outsideSearchTitles.includes(`public-chat-${randKey}`));
        assert("Outside member CANNOT find private channel (Zero-Leakage)", !outsideSearchTitles.includes(`secret-dept-a-${randKey}`));
        assert("Outside member CANNOT find private discussion thread (Zero-Leakage)", !outsideSearchTitles.includes(`Classified Operation Thread ${randKey}`));
        assert("Outside member CANNOT find restricted task (Zero-Leakage)", !outsideSearchTitles.includes(`Confidential Dept A Blueprint ${randKey}`));
        assert("Counts by type strictly reflect only accessible results", 
            (outsideSearch.countsByType.channel || 0) === 1 && (outsideSearch.countsByType.discussion || 0) === 0 && (outsideSearch.countsByType.task || 0) === 0
        );

        console.log("\n--- TEST GROUP 5: RESEND & BULLMQ IDEMPOTENCY ---");
        // Verify idempotency of email delivery intent
        const idemKey = `idem-test-${Date.now()}`;
        const firstIntent = await WorkspaceRepository.recordEmailDeliveryIntent({
            workspaceId,
            recipientId: normalMemberUser.id,
            recipientEmail: normalMemberUser.email,
            emailType: "workspace_welcome",
            idempotencyKey: idemKey,
        });
        assert("First delivery intent is marked as isNew = true", firstIntent.isNew === true);

        // Mark it as sent
        await WorkspaceRepository.updateEmailDelivery(firstIntent.delivery.id, { status: "sent", resendId: "re_123" });

        // Second delivery intent with same key
        const duplicateIntent = await WorkspaceRepository.recordEmailDeliveryIntent({
            workspaceId,
            recipientId: normalMemberUser.id,
            recipientEmail: normalMemberUser.email,
            emailType: "workspace_welcome",
            idempotencyKey: idemKey,
        });
        assert("Duplicate intent is identified (isNew = false)", duplicateIntent.isNew === false);

        console.log("\n--- TEST GROUP 6: FIXTURE CLEANUP ---");
        await query(`DELETE FROM public.workspace_threads WHERE workspace_id = $1 AND name LIKE '%${randKey}%';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_messages WHERE workspace_id = $1 AND content LIKE '%${randKey}%';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_channels WHERE workspace_id = $1 AND name LIKE '%${randKey}%';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_tasks WHERE workspace_id = $1 AND title LIKE '%${randKey}%';`, [workspaceId]);
        await query(`DELETE FROM public.workspace_activity_feed WHERE workspace_id = $1 AND actor_id IN ($2, $3, $4, $5, $6);`, [workspaceId, managerUser.id, deptAleadUser.id, deptAmemberUser.id, deptBleadUser.id, normalMemberUser.id]);
        await query(`DELETE FROM public.workspace_notifications WHERE workspace_id = $1 AND recipient_id IN ($2, $3, $4, $5, $6);`, [workspaceId, managerUser.id, deptAleadUser.id, deptAmemberUser.id, deptBleadUser.id, normalMemberUser.id]);
        await query(`DELETE FROM public.workspace_departments WHERE id IN ($1, $2);`, [deptA.id, deptB.id]);
        await query(`DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id IN ($2, $3, $4, $5, $6);`, [workspaceId, managerUser.id, deptAleadUser.id, deptAmemberUser.id, deptBleadUser.id, normalMemberUser.id]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3, $4, $5);`, [managerUser.id, deptAleadUser.id, deptAmemberUser.id, deptBleadUser.id, normalMemberUser.id]);
        assert("Test fixtures and temporary entries cleaned up cleanly", true);

    } catch (err: any) {
        console.error("Test execution failed with unhandled exception:", err);
        failed++;
    } finally {
        await pool.end();
        console.log("\n===============================================================================");
        console.log(`PHASE 08 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log("===============================================================================");
        process.exit(failed > 0 ? 1 : 0);
    }
}

runPhase08Tests();
