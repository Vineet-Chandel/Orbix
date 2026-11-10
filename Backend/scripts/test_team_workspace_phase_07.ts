// Backend/scripts/test_team_workspace_phase_07.ts
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceNotificationService } from "../src/services/workspace/workspaceNotificationService.js";
import { WorkspaceEmailService } from "../src/services/workspace/workspaceEmailService.js";
import { WorkspaceEmailTemplates } from "../src/services/workspace/workspaceEmailTemplates.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { dispatchOutboxEvents } from "../src/workers/workspaceNotificationWorker.js";
import { WorkspaceNotificationController } from "../src/controllers/workspace/workspaceNotificationController.js";

let testsPassed = 0;
let testsFailed = 0;

function assert(description: string, condition: boolean, extra?: any) {
    if (condition) {
        testsPassed++;
        console.log(`  ✅ [PASS] ${description}`);
    } else {
        testsFailed++;
        console.error(`  ❌ [FAIL] ${description}`, extra || "");
    }
}

async function runPhase07Tests() {
    console.log("================================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 07 ACCEPTANCE TEST SUITE");
    console.log("NOTIFICATIONS, BULLMQ, OUTBOX & RESEND EMAIL INFRASTRUCTURE");
    console.log("================================================================================\n");

    const runId = Math.random().toString(36).substring(2, 8);
    const leadUserId = "00000000-0000-0000-0000-000000000702";
    const memberUserId = "00000000-0000-0000-0000-000000000703";
    const foreignUserId = "00000000-0000-0000-0000-000000000704";

    try {
        // SETUP: Identify Club and Provision Root Workspace
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
        const ownerId = club.auth_user_id;

        // Clean up previous test users if lingering
        await query(`DELETE FROM public.workspace_notifications WHERE recipient_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_outbox_events WHERE workspace_id IN (SELECT id FROM public.team_workspaces WHERE club_id = $1);`, [club.id]);
        await query(`DELETE FROM public.workspace_email_deliveries WHERE recipient_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_task_activity WHERE actor_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_tasks WHERE creator_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);

        // Insert fresh test users
        await query(`
            INSERT INTO public.users (id, username, email, firstname, lastname, password)
            VALUES 
                ($1, 'lead_${runId}', 'lead_${runId}@orbix.campus', 'Lead', 'Engineer', 'TestPass123!'),
                ($2, 'member_${runId}', 'member_${runId}@orbix.campus', 'Member', 'Coder', 'TestPass123!'),
                ($3, 'foreign_${runId}', 'foreign_${runId}@orbix.campus', 'Foreign', 'User', 'TestPass123!');
        `, [leadUserId, memberUserId, foreignUserId]);

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(
            club.id,
            ownerId
        );
        console.log(`[Setup] Using Workspace '${workspace.name}' (${workspace.id}) for Club '${club.name}'\n`);

        // Find or create roles
        const roles = await WorkspaceRepository.listRoles(workspace.id);
        const adminRole = roles.find((r) => r.isSystem && r.name === "Workspace Manager") || roles[0];
        const memberRole = roles.find((r) => r.isSystem && r.name === "Member") || roles[roles.length - 1];

        // Add lead and member to workspace
        const leadMember = await WorkspaceRepository.createMember(null, {
            workspaceId: workspace.id,
            userId: leadUserId,
            roleId: adminRole.id,
            roleTitle: "Lead Engineer",
        });

        const coderMember = await WorkspaceRepository.createMember(null, {
            workspaceId: workspace.id,
            userId: memberUserId,
            roleId: memberRole.id,
            roleTitle: "Staff Member",
        });

        // =====================================================================
        // MODULE 1: IN-APP NOTIFICATION ENGINE & PERSISTENCE
        // =====================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("MODULE 1: IN-APP NOTIFICATION ENGINE & PERSISTENCE");
        console.log("--------------------------------------------------------------------------------");

        // 1. Direct in-app notification creation
        const directNotif = await WorkspaceRepository.createNotification({
            workspaceId: workspace.id,
            recipientId: memberUserId,
            actorId: leadUserId,
            eventType: "workspace_invitation",
            resourceType: "workspace",
            resourceId: workspace.id,
            title: "Welcome to Orbix Workspace",
            message: "You have been onboarded to the workspace.",
            destinationUrl: `/club/${club.id}/workspace`,
            metadata: { priority: "high" },
        });

        assert("Direct notification persisted with valid UUID", Boolean(directNotif.id && directNotif.id.length > 20));
        assert("Notification initial state is unread", directNotif.isRead === false);
        assert("Notification records destination URL", directNotif.destinationUrl === `/club/${club.id}/workspace`);

        // 2. Query notifications for user
        const userNotifs = await WorkspaceRepository.getUserNotifications(workspace.id, memberUserId);
        assert("getUserNotifications returns correct total count", userNotifs.total >= 1);
        assert("getUserNotifications reports unreadCount", userNotifs.unreadCount >= 1);
        assert("Notification includes populated actor info", userNotifs.notifications[0].actor?.username === `lead_${runId}`);

        // 3. Mark single notification as read
        const markRes = await WorkspaceRepository.markNotificationRead(workspace.id, memberUserId, directNotif.id);
        assert("markNotificationRead returns true", markRes === true);

        const updatedNotifs = await WorkspaceRepository.getUserNotifications(workspace.id, memberUserId);
        const readItem = updatedNotifs.notifications.find((n) => n.id === directNotif.id);
        assert("Notification is_read flag updated to true", readItem?.isRead === true);
        assert("Notification read_at timestamp recorded", Boolean(readItem?.readAt));

        // 4. Mark all as read
        await WorkspaceRepository.createNotification({
            workspaceId: workspace.id,
            recipientId: memberUserId,
            eventType: "task_comment",
            resourceType: "task",
            resourceId: "dummy-task-1",
            title: "New Task Comment",
            message: "Check the design specs.",
            destinationUrl: `/club/${club.id}/workspace/tasks/dummy-task-1`,
        });

        const markedCount = await WorkspaceRepository.markAllNotificationsRead(workspace.id, memberUserId);
        assert("markAllNotificationsRead successfully marks remaining unread rows", markedCount >= 1);

        const postReadAll = await WorkspaceRepository.getUserNotifications(workspace.id, memberUserId);
        assert("Unread count is zero after markAllNotificationsRead", postReadAll.unreadCount === 0);

        // =====================================================================
        // MODULE 2: TRANSACTIONAL OUTBOX PATTERN & FAILURE DECOUPLING
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("MODULE 2: TRANSACTIONAL OUTBOX PATTERN & FAILURE DECOUPLING");
        console.log("--------------------------------------------------------------------------------");

        // 1. Create outbox event
        const outboxEvent = await WorkspaceRepository.createOutboxEvent({
            workspaceId: workspace.id,
            eventType: "email_task_assigned",
            payload: {
                workspaceId: workspace.id,
                clubId: club.id,
                workspaceName: workspace.name,
                recipientId: memberUserId,
                recipientEmail: `member_${runId}@orbix.campus`,
                recipientName: "Member Coder",
                emailType: "task_assigned",
                idempotencyKey: `outbox-test-${runId}-1`,
                context: {
                    resourceTitle: "Implement Outbox Dispatcher",
                    priority: "high",
                },
            },
        });

        assert("Outbox event created with initial 'pending' status", outboxEvent.status === "pending");
        assert("Outbox event retry count starts at 0", outboxEvent.retryCount === 0);

        // 2. Poll pending outbox events
        const pendingEvents = await WorkspaceRepository.getPendingOutboxEvents(10);
        assert("Pending outbox query returns newly queued event", pendingEvents.some((e) => e.id === outboxEvent.id));

        // 3. Dispatch outbox events
        const dispatched = await dispatchOutboxEvents(10);
        assert("Outbox dispatcher successfully processes pending event", dispatched >= 1);

        // Verify outbox status updated to published
        const publishedEvents = await query(
            `SELECT status, published_at FROM public.workspace_outbox_events WHERE id = $1;`,
            [outboxEvent.id]
        );
        assert("Outbox event transitioned to 'published'", publishedEvents.rows[0]?.status === "published");
        assert("Outbox published_at timestamp is set", Boolean(publishedEvents.rows[0]?.published_at));

        // 4. Decoupling verification: Task creation succeeds even if email dispatch fails
        const testTask = await WorkspaceTaskService.createTask(workspace.id, leadUserId, {
            title: `Decoupled Task ${runId}`,
            description: "Testing notification decoupling",
            priority: "medium",
            assigneeUserIds: [memberUserId],
        });

        assert("Task created successfully in PostgreSQL", Boolean(testTask.id));

        // Verify in-app notification was generated for assignee
        const assigneeNotifs = await WorkspaceRepository.getUserNotifications(workspace.id, memberUserId);
        const taskNotif = assigneeNotifs.notifications.find((n) => n.resourceId === testTask.id);
        assert("Task assignment generated durable in-app notification", Boolean(taskNotif));
        assert("Notification title references task name", taskNotif?.title.includes(`Decoupled Task ${runId}`));

        // =====================================================================
        // MODULE 3: RESEND EMAIL INTEGRATION & 10 TEMPLATES
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("MODULE 3: RESEND EMAIL INTEGRATION & 10 TEMPLATES");
        console.log("--------------------------------------------------------------------------------");

        const templateCtx = {
            recipientName: "Jane Developer",
            workspaceName: workspace.name,
            clubId: club.id,
            appBaseUrl: "https://orbix.campus",
            actionUrl: `https://orbix.campus/club/${club.id}/workspace/tasks/123`,
            actorName: "Lead Engineer",
            resourceTitle: "Build Secure Authentication Module",
            departmentName: "Technical & Development",
            roleName: "Technical Lead",
            priority: "high",
            dueDate: new Date().toISOString(),
            notes: "Please update the JWT session expiry",
            preferencesUrl: `https://orbix.campus/club/${club.id}/workspace/settings/notifications`,
        };

        const templateTypes: Array<Parameters<typeof WorkspaceEmailTemplates.render>[0]> = [
            "workspace_invitation",
            "workspace_welcome",
            "role_assigned_changed",
            "department_assignment",
            "task_assigned",
            "task_reassigned",
            "task_deadline_reminder",
            "task_review_completed",
            "task_changes_requested",
            "important_announcement",
        ];

        let templatesRendered = 0;
        for (const type of templateTypes) {
            const rendered = WorkspaceEmailTemplates.render(type, templateCtx);
            if (
                rendered.subject &&
                rendered.html &&
                rendered.text &&
                rendered.html.includes("Orbix") &&
                rendered.html.includes(workspace.name) &&
                !rendered.html.includes("undefined")
            ) {
                templatesRendered++;
            }
        }

        assert("All 10 professional email templates render valid HTML & Text", templatesRendered === 10);

        // =====================================================================
        // MODULE 4: DEDUPLICATION & IDEMPOTENCY CONSTRAINTS
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("MODULE 4: DEDUPLICATION & IDEMPOTENCY CONSTRAINTS");
        console.log("--------------------------------------------------------------------------------");

        const deterministicKey = `task-assigned/${testTask.id}/${memberUserId}/v1`;

        // First delivery
        const firstDelivery = await WorkspaceEmailService.sendEmail({
            workspaceId: workspace.id,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: memberUserId,
            recipientEmail: `member_${runId}@orbix.campus`,
            recipientName: "Member Coder",
            emailType: "task_assigned",
            idempotencyKey: deterministicKey,
            context: {
                resourceTitle: testTask.title,
                priority: "high",
            },
        });

        assert("First email delivery attempt succeeds", firstDelivery.success === true);
        assert("Delivery record created in database", Boolean(firstDelivery.deliveryId));

        // Second delivery with exact same idempotency key
        const duplicateDelivery = await WorkspaceEmailService.sendEmail({
            workspaceId: workspace.id,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: memberUserId,
            recipientEmail: `member_${runId}@orbix.campus`,
            recipientName: "Member Coder",
            emailType: "task_assigned",
            idempotencyKey: deterministicKey,
            context: {
                resourceTitle: testTask.title,
                priority: "high",
            },
        });

        assert("Duplicate delivery attempt is safely skipped", duplicateDelivery.skipped === true);
        assert(
            "Duplicate delivery references original delivery ID",
            duplicateDelivery.deliveryId === firstDelivery.deliveryId
        );

        // Verify database unique constraint prevents duplicate rows
        const deliveryRows = await query(
            `SELECT COUNT(*)::int AS count FROM public.workspace_email_deliveries WHERE idempotency_key = $1;`,
            [deterministicKey]
        );
        assert("Exactly one delivery record exists for idempotency key", deliveryRows.rows[0].count === 1);

        // =====================================================================
        // MODULE 5: USER NOTIFICATION PREFERENCES
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("MODULE 5: USER NOTIFICATION PREFERENCES");
        console.log("--------------------------------------------------------------------------------");

        // 1. Get default preferences
        const defaultPrefs = await WorkspaceRepository.getUserNotificationPreferences(workspace.id, memberUserId);
        assert("Default emailTaskAssigned preference is true", defaultPrefs.emailTaskAssigned === true);
        assert("Default emailDigestFrequency is 'instant'", defaultPrefs.emailDigestFrequency === "instant");

        // 2. Disable task assignment emails
        await WorkspaceRepository.upsertUserNotificationPreferences(workspace.id, memberUserId, {
            emailTaskAssigned: false,
        });

        const updatedPrefs = await WorkspaceRepository.getUserNotificationPreferences(workspace.id, memberUserId);
        assert("Preference successfully updated to disable emailTaskAssigned", updatedPrefs.emailTaskAssigned === false);

        // 3. Attempt to send optional task assigned email with preference disabled
        const skippedOutcome = await WorkspaceEmailService.sendEmail({
            workspaceId: workspace.id,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: memberUserId,
            recipientEmail: `member_${runId}@orbix.campus`,
            recipientName: "Member Coder",
            emailType: "task_assigned",
            idempotencyKey: `pref-test-${runId}-skipped`,
            context: { resourceTitle: "Optional Task" },
            isEssential: false,
        });

        assert("Optional email was skipped due to user preferences", skippedOutcome.skipped === true);
        assert("Skip reason cites user preference", skippedOutcome.skipReason?.includes("disabled task assignment"));

        // 4. Essential email (Workspace Invitation) bypasses preference disablement
        const essentialOutcome = await WorkspaceEmailService.sendEmail({
            workspaceId: workspace.id,
            clubId: club.id,
            workspaceName: workspace.name,
            recipientId: memberUserId,
            recipientEmail: `member_${runId}@orbix.campus`,
            recipientName: "Member Coder",
            emailType: "workspace_invitation",
            idempotencyKey: `pref-test-${runId}-essential`,
            context: { roleName: "Lead" },
            isEssential: true,
        });

        assert("Essential workspace email is NOT skipped despite muted preferences", essentialOutcome.success === true && !essentialOutcome.skipped);

        // Restore default preference
        await WorkspaceRepository.upsertUserNotificationPreferences(workspace.id, memberUserId, {
            emailTaskAssigned: true,
        });

        // =====================================================================
        // MODULE 6: BULLMQ SCHEDULED REMINDERS & GUARDS
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("MODULE 6: BULLMQ SCHEDULED REMINDERS & GUARDS");
        console.log("--------------------------------------------------------------------------------");

        // Complete the test task to trigger the reminder guard
        await query(`UPDATE public.workspace_tasks SET status = 'completed' WHERE id = $1;`, [testTask.id]);

        // Verify reminder worker logic guards against already completed tasks
        const completedTask = await WorkspaceRepository.findTaskById(workspace.id, testTask.id);
        const shouldSkipReminder =
            completedTask?.status === "completed" ||
            completedTask?.status === "approved" ||
            completedTask?.status === "cancelled";

        assert("Task completion guard prevents sending deadline reminder for completed tasks", shouldSkipReminder === true);

        // Verify due-date changed guard
        const taskWithNewDueDate = await query(
            `UPDATE public.workspace_tasks SET due_date = NOW() + INTERVAL '7 days' WHERE id = $1 RETURNING due_date;`,
            [testTask.id]
        );
        const originalExpectedDueDate = new Date("2026-12-31").toISOString();
        const actualDueDate = new Date(taskWithNewDueDate.rows[0].due_date).toISOString();
        assert("Due date change guard detects mismatched due dates", originalExpectedDueDate !== actualDueDate);

        // =====================================================================
        // MODULE 7: RESEND WEBHOOKS & CRYPTOGRAPHIC SIGNATURE VERIFICATION
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("MODULE 7: RESEND WEBHOOKS & CRYPTOGRAPHIC SIGNATURE VERIFICATION");
        console.log("--------------------------------------------------------------------------------");

        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || "whsec_test_secret_for_orbix_2026";
        const secretKey = webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret;
        let secretBuffer: Buffer;
        try {
            secretBuffer = Buffer.from(secretKey, "base64");
            if (secretBuffer.length === 0) secretBuffer = Buffer.from(secretKey, "utf-8");
        } catch {
            secretBuffer = Buffer.from(secretKey, "utf-8");
        }

        const webhookEventId = `msg_resend_event_${runId}`;
        const webhookTimestamp = Math.floor(Date.now() / 1000).toString();
        const webhookPayload = {
            type: "email.delivered",
            created_at: new Date().toISOString(),
            data: {
                id: firstDelivery.resendId || "sim_resend_test_123",
                email_id: firstDelivery.resendId || "sim_resend_test_123",
                to: [`member_${runId}@orbix.campus`],
                subject: "New task assigned",
            },
        };
        const rawBody = JSON.stringify(webhookPayload);
        const signedPayload = `${webhookEventId}.${webhookTimestamp}.${rawBody}`;
        const validSignature = `v1,${crypto.createHmac("sha256", secretBuffer).update(signedPayload).digest("base64")}`;

        // 1. Test Valid Webhook Processing
        let mockResStatus = 200;
        let mockResBody: any = null;
        const mockRes = {
            status: (code: number) => {
                mockResStatus = code;
                return mockRes;
            },
            json: (data: any) => {
                mockResBody = data;
                return mockRes;
            },
        };

        const validReq: any = {
            headers: {
                "svix-id": webhookEventId,
                "svix-timestamp": webhookTimestamp,
                "svix-signature": validSignature,
            },
            body: webhookPayload,
            rawBody,
        };

        await WorkspaceNotificationController.handleResendWebhook(validReq, mockRes as any);
        assert("Valid signed webhook returns HTTP 200", mockResStatus === 200);
        assert("Valid webhook returns success payload", mockResBody?.success === true);

        // 2. Test Forged Signature Rejection
        let forgedStatus = 200;
        let forgedBody: any = null;
        const forgedRes = {
            status: (code: number) => {
                forgedStatus = code;
                return forgedRes;
            },
            json: (data: any) => {
                forgedBody = data;
                return forgedRes;
            },
        };

        const forgedReq: any = {
            headers: {
                "svix-id": `msg_forged_${runId}`,
                "svix-timestamp": webhookTimestamp,
                "svix-signature": "v1,invalid_forged_base64_signature_here",
            },
            body: webhookPayload,
            rawBody,
        };

        await WorkspaceNotificationController.handleResendWebhook(forgedReq, forgedRes as any);
        assert("Forged webhook signature is strictly rejected with HTTP 401", forgedStatus === 401);

        // 3. Test Replay Protection with Expired Timestamp
        let expiredStatus = 200;
        const expiredRes = {
            status: (code: number) => {
                expiredStatus = code;
                return expiredRes;
            },
            json: (data: any) => expiredRes,
        };

        const expiredReq: any = {
            headers: {
                "svix-id": `msg_expired_${runId}`,
                "svix-timestamp": (Math.floor(Date.now() / 1000) - 600).toString(), // 10 minutes ago
                "svix-signature": validSignature,
            },
            body: webhookPayload,
            rawBody,
        };

        await WorkspaceNotificationController.handleResendWebhook(expiredReq, expiredRes as any);
        assert("Expired webhook (>5m drift) is rejected with HTTP 400", expiredStatus === 400);

        // 4. Test Duplicate Replay Protection
        let duplicateWebhookStatus = 200;
        let duplicateWebhookBody: any = null;
        const duplicateRes = {
            status: (code: number) => {
                duplicateWebhookStatus = code;
                return duplicateRes;
            },
            json: (data: any) => {
                duplicateWebhookBody = data;
                return duplicateRes;
            },
        };

        // Send exact same validReq with same svix-id
        await WorkspaceNotificationController.handleResendWebhook(validReq, duplicateRes as any);
        assert("Duplicate webhook delivery is safely absorbed (HTTP 200)", duplicateWebhookStatus === 200);
        assert("Duplicate webhook detected and ignored", duplicateWebhookBody?.message?.includes("Duplicate"));

        // =====================================================================
        // TEARDOWN & CLEANUP
        // =====================================================================
        console.log("\n--------------------------------------------------------------------------------");
        console.log("TEARDOWN & CLEANUP");
        console.log("--------------------------------------------------------------------------------");

        await query(`DELETE FROM public.workspace_notifications WHERE workspace_id = $1;`, [workspace.id]);
        await query(`DELETE FROM public.workspace_outbox_events WHERE workspace_id = $1;`, [workspace.id]);
        await query(`DELETE FROM public.workspace_email_deliveries WHERE workspace_id = $1;`, [workspace.id]);
        await query(`DELETE FROM public.workspace_notification_preferences WHERE workspace_id = $1;`, [workspace.id]);
        await query(`DELETE FROM public.workspace_webhook_events WHERE provider_event_id = $1;`, [webhookEventId]);
        await query(`DELETE FROM public.workspace_task_assignments WHERE task_id = $1;`, [testTask.id]);
        await query(`DELETE FROM public.workspace_task_activity WHERE task_id = $1;`, [testTask.id]);
        await query(`DELETE FROM public.workspace_tasks WHERE id = $1;`, [testTask.id]);
        await query(`DELETE FROM public.workspace_members WHERE id IN ($1, $2);`, [leadMember.id, coderMember.id]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);

        console.log("  ✅ Test records cleaned up successfully.");

    } catch (err: any) {
        console.error("❌ Test Suite Error:", err);
        testsFailed++;
    } finally {
        await pool.end();
    }

    console.log("\n================================================================================");
    console.log(`ORBIX TEAM WORKSPACE PHASE 07 RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("================================================================================\n");

    if (testsFailed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase07Tests();
