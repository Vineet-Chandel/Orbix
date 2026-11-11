// Backend/src/services/workspace/workspaceEmailTemplates.ts
import type { WorkspaceEmailType } from "../../types/workspaceTypes.js";

export interface EmailTemplateContext {
    recipientName: string;
    workspaceName: string;
    clubName?: string | undefined;
    clubId: string;
    appBaseUrl: string;
    actionUrl: string;
    actorName?: string | undefined;
    resourceTitle?: string | undefined;
    departmentName?: string | undefined;
    roleName?: string | undefined;
    priority?: string | undefined;
    dueDate?: string | undefined;
    notes?: string | undefined;
    preferencesUrl: string;
}

export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

function baseLayout(title: string, contentHtml: string, context: EmailTemplateContext): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #e2e8f0;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .card {
            background-color: #1e293b;
            border-radius: 12px;
            border: 1px solid #334155;
            padding: 32px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
        }
        .logo-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid #334155;
        }
        .logo-text {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            color: #ffffff;
        }
        .logo-badge {
            background-color: #4f46e5;
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .workspace-name {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }
        h1 {
            color: #ffffff;
            font-size: 22px;
            font-weight: 600;
            margin: 0 0 16px 0;
            line-height: 1.3;
        }
        p {
            color: #cbd5e1;
            font-size: 15px;
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .info-box {
            background-color: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 18px;
            margin-bottom: 24px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 14px;
            border-bottom: 1px solid #1e293b;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            color: #94a3b8;
            font-weight: 500;
        }
        .info-value {
            color: #f8fafc;
            font-weight: 600;
            text-align: right;
        }
        .btn {
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 14px;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            text-align: center;
            transition: background-color 0.2s;
            margin-top: 8px;
            margin-bottom: 24px;
        }
        .btn:hover {
            background-color: #4338ca;
        }
        .footer {
            margin-top: 32px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
        }
        .footer a {
            color: #818cf8;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo-header">
                <span class="logo-text">Orbix</span>
                <span class="logo-badge">Workspace</span>
            </div>
            <div class="workspace-name">${context.workspaceName} ${context.clubName ? `• ${context.clubName}` : ""}</div>
            ${contentHtml}
        </div>
        <div class="footer">
            <p>You received this transactional update regarding your activity in <strong>${context.workspaceName}</strong>.</p>
            <p><a href="${context.preferencesUrl}">Manage notification preferences</a> • <a href="${context.appBaseUrl}">Orbix Campus</a></p>
            <p>&copy; ${new Date().getFullYear()} Orbix. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
}

export class WorkspaceEmailTemplates {
    /**
     * 1. Workspace Invitation
     */
    static renderWorkspaceInvitation(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Invitation to join ${ctx.workspaceName} on Orbix`;
        const html = baseLayout(
            subject,
            `<h1>You've been invited!</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p><strong>${ctx.actorName || "A club manager"}</strong> has invited you to collaborate in <strong>${ctx.workspaceName}</strong> on Orbix.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Workspace:</span><span class="info-value">${ctx.workspaceName}</span></div>
                ${ctx.roleName ? `<div class="info-row"><span class="info-label">Assigned Role:</span><span class="info-value">${ctx.roleName}</span></div>` : ""}
                ${ctx.departmentName ? `<div class="info-row"><span class="info-label">Department:</span><span class="info-value">${ctx.departmentName}</span></div>` : ""}
            </div>
            <p>Join to access team channels, coordinate departmental tasks, and collaborate with members.</p>
            <a href="${ctx.actionUrl}" class="btn">Accept Invitation</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\n${ctx.actorName || "A club manager"} has invited you to join ${ctx.workspaceName} on Orbix.\n\nAccept your invitation: ${ctx.actionUrl}\n\nOrbix Team Workspace`;
        return { subject, html, text };
    }

    /**
     * 2. Welcome to Workspace
     */
    static renderWelcome(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Welcome to ${ctx.workspaceName}!`;
        const html = baseLayout(
            subject,
            `<h1>Welcome aboard, ${ctx.recipientName}!</h1>
            <p>Your membership in <strong>${ctx.workspaceName}</strong> is now active.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Workspace:</span><span class="info-value">${ctx.workspaceName}</span></div>
                ${ctx.roleName ? `<div class="info-row"><span class="info-label">Current Role:</span><span class="info-value">${ctx.roleName}</span></div>` : ""}
                ${ctx.departmentName ? `<div class="info-row"><span class="info-label">Department:</span><span class="info-value">${ctx.departmentName}</span></div>` : ""}
            </div>
            <p>Head to the workspace overview to explore announcements, view channels, and check active tasks.</p>
            <a href="${ctx.actionUrl}" class="btn">Open Workspace</a>`,
            ctx
        );
        const text = `Welcome to ${ctx.workspaceName}, ${ctx.recipientName}!\n\nYour membership is now active.\nOpen workspace: ${ctx.actionUrl}\n\nOrbix Team Workspace`;
        return { subject, html, text };
    }

    /**
     * 3. Role Assigned or Changed
     */
    static renderRoleChanged(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Role updated in ${ctx.workspaceName}: ${ctx.roleName || "New Role"}`;
        const html = baseLayout(
            subject,
            `<h1>Your role has been updated</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p>Your role in <strong>${ctx.workspaceName}</strong> has been updated by <strong>${ctx.actorName || "a workspace administrator"}</strong>.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">New Role:</span><span class="info-value">${ctx.roleName || "Updated Role"}</span></div>
                <div class="info-row"><span class="info-label">Workspace:</span><span class="info-value">${ctx.workspaceName}</span></div>
            </div>
            <p>Your updated workspace permissions are effective immediately.</p>
            <a href="${ctx.actionUrl}" class="btn">View Workspace</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nYour role in ${ctx.workspaceName} was updated to: ${ctx.roleName || "Updated Role"} by ${ctx.actorName || "an administrator"}.\n\nView workspace: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 4. Department Assignment
     */
    static renderDepartmentAssignment(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Added to ${ctx.departmentName || "Department"} in ${ctx.workspaceName}`;
        const html = baseLayout(
            subject,
            `<h1>New Department Assignment</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p>You have been assigned to the <strong>${ctx.departmentName || "Department"}</strong> department in <strong>${ctx.workspaceName}</strong>.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Department:</span><span class="info-value">${ctx.departmentName}</span></div>
                <div class="info-row"><span class="info-label">Assigned By:</span><span class="info-value">${ctx.actorName || "Workspace Manager"}</span></div>
            </div>
            <p>You now have access to department-specific channels, task lists, and shared resources.</p>
            <a href="${ctx.actionUrl}" class="btn">View Department</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nYou were added to ${ctx.departmentName} in ${ctx.workspaceName} by ${ctx.actorName || "Workspace Manager"}.\n\nView department: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 5. New Task Assigned
     */
    static renderTaskAssigned(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `New task assigned: ${ctx.resourceTitle || "Untitled Task"}`;
        const html = baseLayout(
            subject,
            `<h1>New Task Assigned</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p><strong>${ctx.actorName || "A lead"}</strong> assigned you a new task in <strong>${ctx.workspaceName}</strong>.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Task:</span><span class="info-value">${ctx.resourceTitle}</span></div>
                ${ctx.departmentName ? `<div class="info-row"><span class="info-label">Department:</span><span class="info-value">${ctx.departmentName}</span></div>` : ""}
                ${ctx.priority ? `<div class="info-row"><span class="info-label">Priority:</span><span class="info-value">${ctx.priority.toUpperCase()}</span></div>` : ""}
                ${ctx.dueDate ? `<div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">${new Date(ctx.dueDate).toLocaleDateString()}</span></div>` : ""}
            </div>
            <p>Review the task requirements, checklist, and guidelines in your workspace.</p>
            <a href="${ctx.actionUrl}" class="btn">View Task Details</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nYou were assigned to task: ${ctx.resourceTitle} in ${ctx.workspaceName} by ${ctx.actorName || "A lead"}.\nDue date: ${ctx.dueDate || "Not set"}\n\nView task: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 6. Task Reassigned
     */
    static renderTaskReassigned(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Task reassigned: ${ctx.resourceTitle || "Task"}`;
        const html = baseLayout(
            subject,
            `<h1>Task Reassignment</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p>You have been reassigned to work on <strong>${ctx.resourceTitle}</strong> in <strong>${ctx.workspaceName}</strong>.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Task:</span><span class="info-value">${ctx.resourceTitle}</span></div>
                ${ctx.dueDate ? `<div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">${new Date(ctx.dueDate).toLocaleDateString()}</span></div>` : ""}
                ${ctx.notes ? `<div class="info-row"><span class="info-label">Reassignment Notes:</span><span class="info-value">${ctx.notes}</span></div>` : ""}
            </div>
            <a href="${ctx.actionUrl}" class="btn">Open Task</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nYou were reassigned to task: ${ctx.resourceTitle} in ${ctx.workspaceName}.\n\nOpen task: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 7. Task Deadline Reminder
     */
    static renderTaskReminder(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Reminder: Task "${ctx.resourceTitle}" deadline approaching`;
        const html = baseLayout(
            subject,
            `<h1>Deadline Approaching</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p>This is a reminder that the task <strong>${ctx.resourceTitle}</strong> in <strong>${ctx.workspaceName}</strong> is due soon.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Task:</span><span class="info-value">${ctx.resourceTitle}</span></div>
                ${ctx.dueDate ? `<div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">${new Date(ctx.dueDate).toLocaleDateString()}</span></div>` : ""}
                ${ctx.priority ? `<div class="info-row"><span class="info-label">Priority:</span><span class="info-value">${ctx.priority.toUpperCase()}</span></div>` : ""}
            </div>
            <p>Please submit your work or request an extension before the deadline.</p>
            <a href="${ctx.actionUrl}" class="btn">Go to Task</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nReminder: Task "${ctx.resourceTitle}" in ${ctx.workspaceName} is due soon (${ctx.dueDate || "upcoming"}).\n\nGo to task: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 8. Task Review Completed (Approved)
     */
    static renderTaskApproved(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Task Approved: ${ctx.resourceTitle || "Your submission"}`;
        const html = baseLayout(
            subject,
            `<h1>Submission Approved!</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p>Great job! Your submission for <strong>${ctx.resourceTitle}</strong> in <strong>${ctx.workspaceName}</strong> has been approved by <strong>${ctx.actorName || "the reviewer"}</strong>.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Task:</span><span class="info-value">${ctx.resourceTitle}</span></div>
                <div class="info-row"><span class="info-label">Reviewer:</span><span class="info-value">${ctx.actorName || "Lead"}</span></div>
                ${ctx.notes ? `<div class="info-row"><span class="info-label">Feedback:</span><span class="info-value">${ctx.notes}</span></div>` : ""}
            </div>
            <a href="${ctx.actionUrl}" class="btn">View Completed Task</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nYour submission for "${ctx.resourceTitle}" was approved by ${ctx.actorName || "the reviewer"}.\n\nView task: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 9. Changes Requested
     */
    static renderChangesRequested(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Changes Requested: ${ctx.resourceTitle || "Your submission"}`;
        const html = baseLayout(
            subject,
            `<h1>Changes Requested on Your Submission</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p><strong>${ctx.actorName || "The reviewer"}</strong> reviewed your submission for <strong>${ctx.resourceTitle}</strong> in <strong>${ctx.workspaceName}</strong> and requested updates.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Task:</span><span class="info-value">${ctx.resourceTitle}</span></div>
                <div class="info-row"><span class="info-label">Reviewer:</span><span class="info-value">${ctx.actorName || "Lead"}</span></div>
                ${ctx.notes ? `<div class="info-row"><span class="info-label">Review Feedback:</span><span class="info-value">${ctx.notes}</span></div>` : ""}
            </div>
            <p>Please address the feedback and resubmit your work.</p>
            <a href="${ctx.actionUrl}" class="btn">Review Feedback & Update</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nChanges requested on "${ctx.resourceTitle}" by ${ctx.actorName || "the reviewer"}.\nFeedback: ${ctx.notes || "See task details"}\n\nUpdate task: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * 10. Important Workspace Announcement
     */
    static renderAnnouncement(ctx: EmailTemplateContext): RenderedEmail {
        const subject = `Announcement: ${ctx.resourceTitle || ctx.workspaceName}`;
        const html = baseLayout(
            subject,
            `<h1>Important Announcement</h1>
            <p>Hi ${ctx.recipientName},</p>
            <p><strong>${ctx.actorName || "Workspace Leadership"}</strong> posted an important announcement in <strong>${ctx.workspaceName}</strong>.</p>
            <div class="info-box">
                <div class="info-row"><span class="info-label">Topic:</span><span class="info-value">${ctx.resourceTitle}</span></div>
                ${ctx.departmentName ? `<div class="info-row"><span class="info-label">Channel/Scope:</span><span class="info-value">${ctx.departmentName}</span></div>` : ""}
            </div>
            ${ctx.notes ? `<p style="background: #0f172a; padding: 14px; border-radius: 6px; border-left: 3px solid #6366f1;">${ctx.notes}</p>` : ""}
            <a href="${ctx.actionUrl}" class="btn">Read Announcement in Orbix</a>`,
            ctx
        );
        const text = `Hi ${ctx.recipientName},\n\nAnnouncement in ${ctx.workspaceName}: ${ctx.resourceTitle}\n\n${ctx.notes || ""}\n\nRead more: ${ctx.actionUrl}`;
        return { subject, html, text };
    }

    /**
     * Dispatcher helper to render any of the 10 templates by type
     */
    static render(emailType: WorkspaceEmailType, ctx: EmailTemplateContext): RenderedEmail {
        switch (emailType) {
            case "workspace_invitation":
                return this.renderWorkspaceInvitation(ctx);
            case "workspace_welcome":
                return this.renderWelcome(ctx);
            case "role_assigned_changed":
                return this.renderRoleChanged(ctx);
            case "department_assignment":
                return this.renderDepartmentAssignment(ctx);
            case "task_assigned":
                return this.renderTaskAssigned(ctx);
            case "task_reassigned":
                return this.renderTaskReassigned(ctx);
            case "task_deadline_reminder":
                return this.renderTaskReminder(ctx);
            case "task_review_completed":
                return this.renderTaskApproved(ctx);
            case "task_changes_requested":
                return this.renderChangesRequested(ctx);
            case "important_announcement":
                return this.renderAnnouncement(ctx);
            default:
                throw new Error(`Unsupported email type: ${emailType}`);
        }
    }
}
