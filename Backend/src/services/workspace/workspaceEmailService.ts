// Backend/src/services/workspace/workspaceEmailService.ts
import { Resend } from "resend";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceEmailTemplates, type EmailTemplateContext } from "./workspaceEmailTemplates.js";
import type { WorkspaceEmailType, WorkspaceEmailDelivery } from "../../types/workspaceTypes.js";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://orbix.campus";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Orbix Team Workspace <workspace@orbix.campus>";

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
    const key = process.env.RESEND_API_KEY;
    if (!key || key.trim() === "" || key.includes("your_resend_api_key")) {
        return null;
    }
    if (!resendInstance) {
        resendInstance = new Resend(key.trim());
    }
    return resendInstance;
}

export interface SendWorkspaceEmailOptions {
    workspaceId: string;
    clubId: string;
    workspaceName: string;
    recipientId: string;
    recipientEmail: string;
    recipientName: string;
    emailType: WorkspaceEmailType;
    idempotencyKey: string;
    context: Partial<EmailTemplateContext>;
    isEssential?: boolean; // If true, ignores user mute and email preference toggles
}

export interface SendEmailOutcome {
    success: boolean;
    skipped?: boolean;
    skipReason?: string;
    deliveryId?: string;
    resendId?: string | null;
    isSimulated?: boolean;
    error?: string;
}

export class WorkspaceEmailService {
    /**
     * Sends an email via Resend with deduplication, preference validation, and transactional logging.
     */
    static async sendEmail(options: SendWorkspaceEmailOptions): Promise<SendEmailOutcome> {
        const {
            workspaceId,
            clubId,
            workspaceName,
            recipientId,
            recipientEmail,
            emailType,
            idempotencyKey,
            context,
            isEssential = false,
        } = options;

        // 1. Preference Validation
        if (!isEssential && emailType !== "workspace_invitation" && emailType !== "workspace_welcome") {
            const prefs = await WorkspaceRepository.getUserNotificationPreferences(workspaceId, recipientId);

            // Check global mute window
            if (prefs.mutedUntil && new Date(prefs.mutedUntil) > new Date()) {
                return {
                    success: true,
                    skipped: true,
                    skipReason: "User muted workspace notifications",
                };
            }

            // Check digest frequency (if user chose 'none' for instant emails)
            if (prefs.emailDigestFrequency === "none") {
                return {
                    success: true,
                    skipped: true,
                    skipReason: "User opted out of email notifications",
                };
            }

            // Check type-specific toggles
            if (
                (emailType === "task_assigned" || emailType === "task_reassigned") &&
                !prefs.emailTaskAssigned
            ) {
                return {
                    success: true,
                    skipped: true,
                    skipReason: "User disabled task assignment emails",
                };
            }

            if (emailType === "task_deadline_reminder" && !prefs.emailTaskReminders) {
                return {
                    success: true,
                    skipped: true,
                    skipReason: "User disabled task reminder emails",
                };
            }
        }

        // 2. Email Delivery Intent & Deduplication Record
        const { delivery, isNew } = await WorkspaceRepository.recordEmailDeliveryIntent({
            workspaceId,
            recipientId,
            recipientEmail,
            emailType,
            idempotencyKey,
        });

        // If this exact delivery was already sent or delivered, return without duplicate sending
        if (!isNew && (delivery.status === "sent" || delivery.status === "delivered")) {
            return {
                success: true,
                skipped: true,
                skipReason: `Email already delivered with idempotency key ${idempotencyKey}`,
                deliveryId: delivery.id,
                resendId: delivery.resendId,
            };
        }

        // 3. Render Template
        const fullContext: EmailTemplateContext = {
            recipientName: options.recipientName || "Member",
            workspaceName,
            clubId,
            appBaseUrl: APP_BASE_URL,
            actionUrl: context.actionUrl || `${APP_BASE_URL}/club/${clubId}/workspace`,
            actorName: context.actorName,
            resourceTitle: context.resourceTitle,
            departmentName: context.departmentName,
            roleName: context.roleName,
            priority: context.priority,
            dueDate: context.dueDate,
            notes: context.notes,
            preferencesUrl: `${APP_BASE_URL}/club/${clubId}/workspace/settings/notifications`,
        };

        const rendered = WorkspaceEmailTemplates.render(emailType, fullContext);

        // 4. Send via Resend (or fallback simulation)
        const resend = getResendClient();

        if (!resend) {
            // Simulated / Dry-run delivery (for local development or testing)
            const simulatedId = `sim_resend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                status: "sent",
                resendId: simulatedId,
                sentAt: new Date(),
            });

            return {
                success: true,
                isSimulated: true,
                deliveryId: delivery.id,
                resendId: simulatedId,
            };
        }

        try {
            const sendResult = await resend.emails.send({
                from: RESEND_FROM_EMAIL,
                to: recipientEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
                headers: {
                    "X-Entity-Ref-ID": idempotencyKey,
                },
            });

            if (sendResult.error) {
                const errorMsg = sendResult.error.message || "Resend API error";
                await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                    status: "failed",
                    error: errorMsg,
                });
                return {
                    success: false,
                    deliveryId: delivery.id,
                    error: errorMsg,
                };
            }

            const resendMessageId = sendResult.data?.id || null;
            await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                status: "sent",
                resendId: resendMessageId,
                sentAt: new Date(),
            });

            return {
                success: true,
                deliveryId: delivery.id,
                resendId: resendMessageId,
            };
        } catch (err: any) {
            const errorMsg = err.message || "Failed to dispatch email via Resend";
            await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                status: "failed",
                error: errorMsg,
            });
            return {
                success: false,
                deliveryId: delivery.id,
                error: errorMsg,
            };
        }
    }
}
