import { query } from "../../database/client.js";
import { dispatchEmail, DEFAULT_SYSTEM_FROM } from "../email/resendService.js";

export interface EventEmailPayload {
    eventId: string;
    stageId?: string;
    triggerType: string;
    recipientEmail: string;
    recipientUserId?: string;
    participantName: string;
    eventTitle: string;
    clubName: string;
    stageName?: string;
    headline: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    deadline?: string;
    receiptCode?: string;
    badgeText?: string;
}

export class EventNotificationService {
    /**
     * Dispatch an event-triggered email with idempotent deduplication
     */
    static async dispatchEventEmail(payload: EventEmailPayload): Promise<{ success: boolean; skipped?: boolean }> {
        const idempotencyKey = payload.stageId
            ? `${payload.triggerType}:${payload.stageId}:${payload.recipientEmail.toLowerCase()}`
            : `${payload.triggerType}:${payload.eventId}:${payload.recipientEmail.toLowerCase()}`;

        // Check if already sent
        try {
            const existing = await query(
                `SELECT id FROM club_event_communication_logs WHERE idempotency_key = $1 LIMIT 1;`,
                [idempotencyKey]
            );

            if (existing.rows.length > 0) {
                return { success: true, skipped: true };
            }

            const subject = `${payload.headline} — ${payload.eventTitle} | Orbix`;
            const html = this.buildEventEmailHtml(payload);

            const result = await dispatchEmail({
                to: payload.recipientEmail,
                subject,
                html,
                text: `${payload.headline}\n\n${payload.message}\n\nEvent: ${payload.eventTitle}\nHosted by: ${payload.clubName}`,
                defaultFromEmail: DEFAULT_SYSTEM_FROM,
                fromName: "Orbix Events",
                logContext: `Event Email (${payload.triggerType})`,
            });

            await query(
                `INSERT INTO club_event_communication_logs 
                    (event_id, stage_id, trigger_type, recipient_email, recipient_user_id, subject, idempotency_key, status, provider_message_id, error_message)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (idempotency_key) DO NOTHING;`,
                [
                    payload.eventId,
                    payload.stageId || null,
                    payload.triggerType,
                    payload.recipientEmail,
                    payload.recipientUserId || null,
                    subject,
                    idempotencyKey,
                    result.success ? "sent" : "failed",
                    result.messageId || null,
                    result.error || null,
                ]
            );

            return { success: result.success };
        } catch (err: any) {
            console.error(`[EventNotificationService] Failed to dispatch email (${payload.triggerType}):`, err);
            return { success: false };
        }
    }

    /**
     * Reusable Neo-Brutalist Orbix Email Template
     */
    private static buildEventEmailHtml(p: EventEmailPayload): string {
        const frontendUrl = process.env.FRONTEND_URL || "https://orbix.in";
        const ctaUrl = p.actionUrl || `${frontendUrl}/college-events`;
        const ctaLabel = p.actionLabel || "View Event on Orbix";

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${p.headline}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 2px solid #000000; border-radius: 16px; box-shadow: 6px 6px 0px #000000; overflow: hidden;">
    <!-- Header Ribbon -->
    <tr>
      <td style="background-color: #000000; padding: 16px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align: middle;">
              <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase;">
                ORBIX
              </span>
            </td>
            <td align="right">
              <span style="background-color: #FFE566; color: #000000; padding: 4px 12px; border-radius: 999px; border: 1.5px solid #000000; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                ${p.badgeText || "Campus Event"}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px 28px;">
        <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #666666; margin-bottom: 6px;">
          Hosted by ${p.clubName}
        </div>
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 900; color: #000000; line-height: 1.25;">
          ${p.headline}
        </h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333; font-weight: 500;">
          Hi <strong style="color: #000000;">${p.participantName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333; font-weight: 500;">
          ${p.message}
        </p>

        ${
            p.stageName || p.deadline || p.receiptCode
                ? `
        <!-- Event Details Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; box-shadow: 3px 3px 0px #000000; padding: 16px;">
          <tr>
            <td>
              ${
                  p.stageName
                      ? `<div style="font-size: 11px; font-weight: 900; color: #666666; text-transform: uppercase;">Stage / Round</div>
                         <div style="font-size: 14px; font-weight: 900; color: #000000; margin-bottom: 10px;">${p.stageName}</div>`
                      : ""
              }
              ${
                  p.deadline
                      ? `<div style="font-size: 11px; font-weight: 900; color: #666666; text-transform: uppercase;">Submission Deadline</div>
                         <div style="font-size: 13px; font-weight: 900; color: #b91c1c; margin-bottom: 10px;">${p.deadline}</div>`
                      : ""
              }
              ${
                  p.receiptCode
                      ? `<div style="font-size: 11px; font-weight: 900; color: #666666; text-transform: uppercase;">Submission Receipt Code</div>
                         <div style="font-family: monospace; font-size: 14px; font-weight: 900; color: #000000;">${p.receiptCode}</div>`
                      : ""
              }
            </td>
          </tr>
        </table>`
                : ""
        }

        <!-- Primary CTA Button -->
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0 16px 0;">
          <tr>
            <td align="center" style="background-color: #a2ff86; border: 2px solid #000000; border-radius: 12px; box-shadow: 3px 3px 0px #000000;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; text-decoration: none;">
                ${ctaLabel} &rarr;
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 20px 0 0 0; font-size: 11px; color: #777777;">
          This is an official event execution communication sent via Orbix on behalf of ${p.clubName}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
}
