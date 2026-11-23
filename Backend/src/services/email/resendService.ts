import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";


export const DEFAULT_SYSTEM_FROM = process.env.RESEND_FROM_EMAIL || "team@vineetchandel.in";
export const DEFAULT_FOUNDER_FROM = process.env.FOUNDER_FROM_EMAIL || "Vineet <vineet@vineetchandel.in>";
export const DEFAULT_FOUNDER_REPLY_TO = process.env.FOUNDER_REPLY_EMAIL || "vineet@vineetchandel.in";

export interface SendVerificationEmailOptions {
  to: string;
  name?: string;
  otp: string;
}

export interface SendSecurityNotificationEmailOptions {
  to: string;
  name?: string;
  subject: string;
  badgeText?: string;
  headline: string;
  message: string;
  otp?: string;
  otpLabel?: string;
  isWarning?: boolean;
  footerNotice?: string;
}

export interface SendEmailResult {
  success: boolean;
  simulated?: boolean | undefined;
  messageId?: string | undefined;
  id?: string | undefined;
  error?: string | undefined;
  provider?: "resend" | "smtp" | "simulation" | string | undefined;
  sandboxRestricted?: boolean | undefined;
}

export interface EmailDispatchDeps {
  resendClient?: {
    emails: {
      send: (payload: any) => Promise<{ data?: any; error?: any }>;
    };
  } | null;
  smtpTransporter?: Pick<Transporter, "sendMail"> | null;
}

let resendClientInstance: Resend | null = null;
let cachedResendApiKey: string | null = null;
let smtpTransporterInstance: Transporter | null = null;
let cachedSmtpConfigKey: string | null = null;

function isPlaceholderEmailValue(val: string | undefined, extraPatterns: string[] = []): boolean {
  if (!val || !val.trim()) return true;
  const lower = val.trim().toLowerCase();
  const basePatterns = ["your_resend_api_key", "yourdomain.com", "your_email@gmail.com", "placeholder"];
  return [...basePatterns, ...extraPatterns].some((p) => lower.includes(p));
}

function isVerifiedProductionResendSender(fromEmail: string | undefined): boolean {
  if (!fromEmail || !fromEmail.trim()) return false;
  const lower = fromEmail.trim().toLowerCase();
  if (!lower.includes("@")) return false;
  if (lower.includes("@resend.dev") || lower.includes("@yourdomain.com") || lower.includes("your_")) {
    return false;
  }
  return true;
}

/**
 * Returns an authenticated Resend client instance if RESEND_API_KEY is configured.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (isPlaceholderEmailValue(apiKey)) {
    resendClientInstance = null;
    cachedResendApiKey = null;
    return null;
  }
  if (!resendClientInstance || cachedResendApiKey !== apiKey) {
    resendClientInstance = new Resend(apiKey);
    cachedResendApiKey = apiKey!;
  }
  return resendClientInstance;
}

/**
 * Returns a configured Nodemailer SMTP transporter if SMTP credentials are provided.
 * Supports standard SMTP (Gmail App Passwords, SendGrid, Amazon SES, Brevo, custom SMTP).
 */
export function getSmtpTransporter(): Transporter | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD)?.trim();
  const explicitHost = process.env.SMTP_HOST?.trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user)?.trim();

  if (
    !user ||
    !pass ||
    isPlaceholderEmailValue(user) ||
    isPlaceholderEmailValue(pass, ["xxxx"]) ||
    !fromEmail ||
    !fromEmail.includes("@")
  ) {
    smtpTransporterInstance = null;
    cachedSmtpConfigKey = null;
    return null;
  }

  const isGmail = user.toLowerCase().includes("@gmail.com");
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !explicitHost && !isGmail) {
    smtpTransporterInstance = null;
    cachedSmtpConfigKey = null;
    return null;
  }

  const host = explicitHost || (isGmail ? "smtp.gmail.com" : "localhost");
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  const configKey = `${host}|${port}|${secure}|${user}|${pass}|${fromEmail}`;
  if (!smtpTransporterInstance || cachedSmtpConfigKey !== configKey) {
    smtpTransporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: pass.replace(/\s+/g, ""), // clean accidental spaces in app passwords
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    cachedSmtpConfigKey = configKey;
  }

  return smtpTransporterInstance;
}

/**
 * Checks whether an error from Resend indicates trial sandbox recipient restriction.
 */
function isResendSandboxError(errorMsg?: string): boolean {
  if (!errorMsg) return false;
  const lower = errorMsg.toLowerCase();
  return (
    lower.includes("only send testing emails to your own email address") ||
    lower.includes("verify a domain at resend.com/domains") ||
    (lower.includes("validation_error") && lower.includes("domain"))
  );
}

/**
 * Sends an email using Nodemailer SMTP transporter.
 */
async function sendViaSmtp(
  transporter: Pick<Transporter, "sendMail">,
  options: { to: string; subject: string; html: string; text: string; fromName: string }
): Promise<SendEmailResult> {
  const { to, subject, html, text, fromName } = options;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromHeader = `"${fromName}" <${fromEmail}>`;

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to,
      subject,
      html,
      text,
    });

    console.log(`[SMTP Transporter] Email dispatched successfully to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      simulated: false,
      provider: "smtp",
      messageId: info.messageId,
    };
  } catch (smtpErr: any) {
    console.error(`[SMTP Error] Failed sending email to ${to}:`, smtpErr?.message || "SMTP dispatch error");
    return {
      success: false,
      simulated: false,
      provider: "smtp",
      error: smtpErr?.message || "Failed to dispatch email via SMTP",
    };
  }
}

export interface DispatchEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string | undefined;
  from?: string | undefined;
  customFrom?: string | undefined;
  fromName?: string | undefined;
  defaultFromEmail?: string | undefined;
  replyTo?: string | undefined;
  logContext?: string | undefined;
  idempotencyKey?: string | undefined;
  priority?: "HIGH" | "NORMAL" | "LOW" | undefined;
  emailType?: string | undefined;
  userId?: string | undefined;
  eventId?: string | undefined;
  campaignId?: string | undefined;
}

/**
 * Raw multi-provider dispatcher (Resend API or SMTP).
 * Called by worker or directly during high-priority synchronous attempt.
 */
export async function executeDirectProviderDispatch(
  payload: DispatchEmailPayload,
  deps?: EmailDispatchDeps
): Promise<SendEmailResult> {
  const { to, subject, html } = payload;
  const text = payload.text || "";
  const fromName = payload.fromName || "Orbix";
  const defaultFromEmail = payload.defaultFromEmail || payload.from || payload.customFrom || DEFAULT_SYSTEM_FROM;
  const logContext = payload.logContext || `Email -> ${to}`;
  const normalizedTo = to.trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === "production";

  const resendClient = deps?.resendClient !== undefined ? deps.resendClient : getResendClient();
  const smtpTransporter = deps?.smtpTransporter !== undefined ? deps.smtpTransporter : getSmtpTransporter();
  const providerPref = (process.env.EMAIL_PROVIDER || "auto").toLowerCase();

  const customFromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const isCustomDomain = isVerifiedProductionResendSender(customFromEmail);
  const resendUsable = Boolean(resendClient && (!isProduction || isCustomDomain));

  // 0. No usable provider configured
  if (
    (!resendUsable && !smtpTransporter) ||
    (providerPref === "smtp" && !smtpTransporter) ||
    (providerPref === "resend" && !resendUsable)
  ) {
    if (isProduction) {
      const reason =
        resendClient && !isCustomDomain
          ? "RESEND_FROM_EMAIL must be configured with a verified custom sender domain in production (sandbox @resend.dev or placeholder senders are rejected)."
          : "No verified production email provider (Resend with verified sender domain or SMTP) is configured.";
      console.error(`[EMAIL DISPATCHER] Production email delivery blocked for ${logContext}: ${reason}`);
      return {
        success: false,
        simulated: false,
        sandboxRestricted: Boolean(resendClient && !isCustomDomain),
        error: reason,
      };
    }

    // Explicit non-production simulation ONLY when no provider is selected/usable
    if (!resendClient && !smtpTransporter) {
      console.log(
        `[DEV MODE SIMULATION] Non-production email simulation for ${logContext} to ${normalizedTo} (content redacted).`
      );

      return {
        success: true,
        simulated: true,
        provider: "simulation",
        messageId: `simulated_${Date.now()}`,
      };
    }
  }

  // 1. Explicit SMTP preference
  if (providerPref === "smtp" && smtpTransporter) {
    return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
  }

  // 2. Resend API Flow
  if (resendClient && providerPref !== "smtp") {
    const isResendInternalTestAddress = normalizedTo.endsWith("@resend.dev");

    // In production, never dispatch through unverified sandbox sender; route directly to SMTP if configured.
    if (!isCustomDomain && !isResendInternalTestAddress && smtpTransporter) {
      console.log(`[Email Dispatcher] Resend custom sender unconfigured for ${normalizedTo}. Routing via SMTP...`);
      return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
    }

    if (resendUsable) {
      try {
        const from = customFromEmail
          ? (customFromEmail.includes("<") ? customFromEmail : `${fromName} <${customFromEmail}>`)
          : `${fromName} <${defaultFromEmail}>`;
        const { data, error } = await resendClient.emails.send({
          from,
          to: [normalizedTo],
          subject,
          html,
          text,
        });

        if (error) {
          const errorMsg = error.message || "Failed to dispatch via Resend";
          console.error(`[Resend API Error] Delivery failed for ${logContext}:`, errorMsg);

          if (isResendSandboxError(errorMsg)) {
            if (smtpTransporter && providerPref !== "resend") {
              console.log(`[Email Dispatcher] Resend sandbox restriction encountered. Failing over to SMTP...`);
              return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
            }

            return {
              success: false,
              simulated: false,
              sandboxRestricted: true,
              provider: "resend",
              error: errorMsg,
            };
          }

          if (smtpTransporter && providerPref !== "resend") {
            console.log(`[Email Dispatcher] Resend delivery error. Attempting failover to SMTP...`);
            return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
          }

          return {
            success: false,
            simulated: false,
            provider: "resend",
            error: errorMsg,
          };
        }

        console.log(`[Resend API] ${logContext} sent successfully to ${normalizedTo} (ID: ${data?.id})`);
        return {
          success: true,
          simulated: false,
          provider: "resend",
          messageId: data?.id,
        };
      } catch (resendEx: any) {
        const safeErr = resendEx?.message || "Internal error sending email via Resend";
        console.error(`[Resend Exception] Delivery failed for ${logContext}:`, safeErr);
        if (smtpTransporter && providerPref !== "resend") {
          console.log(`[Email Dispatcher] Resend exception. Failing over to SMTP...`);
          return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
        }
        return {
          success: false,
          simulated: false,
          provider: "resend",
          error: safeErr,
        };
      }
    }
  }

  // 3. SMTP-Only Flow
  if (smtpTransporter) {
    return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
  }

  return {
    success: false,
    simulated: false,
    error: "No usable email transport configured.",
  };
}

/**
 * Production-Grade Fault-Tolerant Email Gateway.
 * Persists all emails into durable PostgreSQL jobs and dispatches them via BullMQ
 * with isolated recipient execution, exponential backoff, and dead-letter protection.
 */
export async function dispatchEmail(
  payload: DispatchEmailPayload,
  deps?: EmailDispatchDeps
): Promise<SendEmailResult> {
  const isQueueEnabled = process.env.EMAIL_QUEUE_ENABLED !== "false";

  // If queues are explicitly disabled (e.g. testing with mock deps), run raw provider send
  if (!isQueueEnabled) {
    return executeDirectProviderDispatch(payload, deps);
  }

  const { to, subject, html, text, priority, emailType, userId, eventId, campaignId } = payload;
  const normalizedTo = to.trim().toLowerCase();
  const resolvedEmailType = emailType || "transactional";

  // Infer priority: Authentication OTPs, 2FA, password resets, and security alerts are HIGH priority
  const resolvedPriority: "HIGH" | "NORMAL" | "LOW" =
    priority ||
    (subject.toLowerCase().includes("verification") ||
    subject.toLowerCase().includes("code") ||
    subject.toLowerCase().includes("password reset") ||
    subject.toLowerCase().includes("security")
      ? "HIGH"
      : "NORMAL");

  const idempotencyKey =
    payload.idempotencyKey ||
    `email-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${normalizedTo}`;

  try {
    const { EmailDeliveryService } = await import("./emailDeliveryService.js");
    const { EmailQueueService } = await import("./emailQueueService.js");

    // 1. Create durable job record in PostgreSQL
    const { job, isNew } = await EmailDeliveryService.createDeliveryJob({
      campaignId,
      eventId,
      userId,
      recipientEmail: normalizedTo,
      subject,
      htmlBody: html,
      textBody: text,
      emailType: resolvedEmailType,
      priority: resolvedPriority,
      idempotencyKey,
      metadata: { logContext: payload.logContext },
    });

    // If job was already sent previously (idempotency replay), return existing success
    if (job.status === "SENT") {
      return {
        success: true,
        simulated: false,
        provider: job.provider || "resend",
        messageId: job.providerMessageId || undefined,
      };
    }

    // 2. High-priority interactive requests: attempt immediate inline delivery
    if (resolvedPriority === "HIGH") {
      const startedAt = new Date();
      const sendResult = await executeDirectProviderDispatch(payload, deps);
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      if (sendResult.success) {
        const messageId = sendResult.messageId || sendResult.id || null;
        await EmailDeliveryService.recordAttempt({
          jobId: job.id,
          attemptNumber: 1,
          workerId: "inline-gateway",
          startedAt,
          completedAt,
          durationMs,
          status: "SUCCESS",
          provider: sendResult.provider || "resend",
          providerMessageId: messageId || undefined,
          providerResponse: sendResult,
        });

        await EmailDeliveryService.markSuccess(job.id, sendResult.provider || "resend", messageId);
        return sendResult;
      }

      // If immediate attempt failed transiently, don't fail user operation:
      // Schedule background retry with exponential backoff & enqueue to queue!
      await EmailDeliveryService.recordAttempt({
        jobId: job.id,
        attemptNumber: 1,
        workerId: "inline-gateway",
        startedAt,
        completedAt,
        durationMs,
        status: "TRANSIENT_FAILURE",
        errorMessage: sendResult.error,
      });

      await EmailDeliveryService.markFailure(job.id, new Error(sendResult.error || "Inline dispatch failed"), "inline-gateway", 1);
      await EmailQueueService.enqueueEmailJob({
        jobId: job.id,
        priority: resolvedPriority,
        emailType: job.emailType,
        recipientEmail: job.recipientEmail,
      });

      return {
        success: true,
        simulated: false,
        id: job.id,
        error: "Dispatched to background queue for resilient delivery",
      };
    }

    // 3. Normal / Background priority: enqueue to BullMQ
    await EmailQueueService.enqueueEmailJob({
      jobId: job.id,
      priority: resolvedPriority,
      emailType: job.emailType,
      recipientEmail: job.recipientEmail,
    });

    return {
      success: true,
      simulated: false,
      id: job.id,
    };
  } catch (queueErr: any) {
    console.warn(`[dispatchEmail] Queue error, executing raw fallback dispatch:`, queueErr.message);
    // In the unlikely event of database failure creating job, fall back to direct dispatch
    return executeDirectProviderDispatch(payload, deps);
  }
}

/**
 * Generates the clean Neo-Brutalist HTML template matching the Orbix design system.
 */
function generateVerificationEmailHtml(options: { name: string; otp: string; email: string }): string {
  const { name, otp, email } = options;
  const recipientName = name && name.trim() ? name.trim() : "Developer";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orbix Email Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 16px; box-shadow: 4px 4px 0px #000000; overflow: hidden; border-collapse: separate;" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #000000; padding: 18px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <!-- Exact Orbix Brand Logo from Sidebar + Brand Name -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 9px; line-height: 0; font-size: 0;">
                          <img src="https://res.cloudinary.com/bh1mhiwb/image/upload/c_fit,h_120,w_120/v1793205819/orbix/brand/orbix_logo_green.png" 
                               alt="Orbix Logo" 
                               width="24" 
                               height="24" 
                               style="display: block; width: 24px; height: 24px; border: 0; outline: none; text-decoration: none;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            ORBIX
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <!-- Pill with Verify Account -->
                    <span style="background-color: #FFE566; color: #000000; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; box-shadow: 1px 1px 0px #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                      Verify Account
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Content -->
          <tr>
            <td style="padding: 32px 28px 28px 28px;">
              <!-- Neo-Brutalist Mail Hero Icon Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center" style="width: 50px; height: 50px; background-color: #FFE566; border: 2px solid #000000; border-radius: 12px; box-shadow: 3px 3px 0px #000000; text-align: center; vertical-align: middle; padding: 0;">
                    <img src="https://res.cloudinary.com/bh1mhiwb/image/upload/c_fit,h_120,w_120/v1793205819/orbix/brand/orbix_mail_badge.png" 
                         alt="Email" 
                         width="28" 
                         height="28" 
                         style="display: block; width: 28px; height: 28px; margin: 0 auto; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 900; color: #000000; letter-spacing: -0.5px;">
                Confirm Your Email Address
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #444444; font-weight: 500;">
                Hello <strong style="color: #000000;">${recipientName}</strong>, use the single-use 6-digit verification code below to verify <strong style="color: #000000;">${email}</strong> for your Orbix account.
              </p>

              <!-- Neo-Brutalist Code Box with Lucide Key & Clock SVGs -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0 8px 0;">
                <tr>
                  <td align="center" style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 14px; box-shadow: 3px 3px 0px #000000; padding: 24px 16px;">
                    <!-- Verification Code Label with Lucide KeyRound SVG -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 8px auto;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 6px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path>
                            <circle cx="16.5" cy="7.5" r=".5" fill="#666666"></circle>
                          </svg>
                        </td>
                        <td style="vertical-align: middle; font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #666666;">
                          Verification Code
                        </td>
                      </tr>
                    </table>

                    <!-- 6-Digit OTP Display -->
                    <div style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #000000; line-height: 1.2;">
                      ${otp}
                    </div>

                    <!-- Expiration Info with Lucide Clock SVG -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 10px auto 0 auto;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 5px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </td>
                        <td style="vertical-align: middle; font-size: 11px; font-weight: 700; color: #555555;">
                          Expires in 10 minutes • Valid for one attempt
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer with Orbix Brand Logo -->
          <tr>
            <td style="padding: 18px 28px 14px 28px; border-top: 1px solid #EEEEEE; background-color: #FAFAFA; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 7px; line-height: 0; font-size: 0;">
                    <img src="https://res.cloudinary.com/bh1mhiwb/image/upload/c_fit,h_60,w_60/v1793205819/orbix/brand/orbix_logo_gray.png" 
                         alt="Orbix" 
                         width="14" 
                         height="14" 
                         style="display: block; width: 14px; height: 14px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td style="vertical-align: middle; font-size: 11px; font-weight: 700; color: #888888; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Orbix • Unified Developer Identity & Analytics
                  </td>
                </tr>
              </table>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #AAAAAA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Automated security message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

          <!-- Bottom Desk Shelf Illustration -->
          <tr>
            <td align="center" style="padding: 0; line-height: 0; font-size: 0; background-color: #FAFAFA; text-align: center;">
              <img src="https://res.cloudinary.com/dj0ivep44/image/upload/v1793203068/98898242-5f9b-4587-afc3-c1b298d918d7.png" 
                   alt="Orbix Workspace" 
                   width="520" 
                   style="display: block; width: 100%; max-width: 520px; height: auto; border: 0; margin: 0 auto; outline: none; text-decoration: none;" />
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the clean Neo-Brutalist HTML template for security notification emails.
 */
function generateSecurityNotificationHtml(options: {
  name: string;
  headline: string;
  message: string;
  subject: string;
  badgeText: string;
  isWarning: boolean;
  otp?: string | undefined;
  otpLabel?: string | undefined;
  footerNotice: string;
}): string {
  const { name, headline, message, subject, badgeText, isWarning, otp, otpLabel, footerNotice } = options;
  const headerBadgeBg = isWarning ? "#FF6B6B" : "#FFE566";
  const headerBadgeText = isWarning ? "#FFFFFF" : "#000000";

  const otpSection = otp ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0 8px 0;">
        <tr>
          <td align="center" style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 14px; box-shadow: 3px 3px 0px #000000; padding: 24px 16px;">
            <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #666666; margin-bottom: 8px;">
              ${otpLabel || "Verification Code"}
            </div>
            <div style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #000000; line-height: 1.2;">
              ${otp}
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #555555; margin-top: 10px;">
              Expires in 10 minutes • Valid for one attempt
            </div>
          </td>
        </tr>
      </table>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 16px; box-shadow: 4px 4px 0px #000000; overflow: hidden; border-collapse: separate;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background-color: #000000; padding: 18px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <!-- Exact Orbix Brand Logo from Sidebar + Brand Name -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 9px; line-height: 0; font-size: 0;">
                          <img src="https://res.cloudinary.com/bh1mhiwb/image/upload/c_fit,h_120,w_120/v1793205819/orbix/brand/orbix_logo_green.png" 
                               alt="Orbix Logo" 
                               width="24" 
                               height="24" 
                               style="display: block; width: 24px; height: 24px; border: 0; outline: none; text-decoration: none;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            ORBIX
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="background-color: ${headerBadgeBg}; color: ${headerBadgeText}; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px 28px 28px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 900; color: #000000; letter-spacing: -0.5px;">
                ${headline}
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #444444; font-weight: 500;">
                Hello <strong>${name}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #444444; font-weight: 500;">
                ${message}
              </p>
              ${otpSection}
              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #777777; font-weight: 500; border-top: 1px solid #EEEEEE; padding-top: 16px;">
                ${footerNotice}
              </p>
            </td>
          </tr>

          <!-- Footer with Orbix Brand Logo -->
          <tr>
            <td style="padding: 18px 28px 14px 28px; border-top: 1px solid #EEEEEE; background-color: #FAFAFA; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 7px; line-height: 0; font-size: 0;">
                    <img src="https://res.cloudinary.com/bh1mhiwb/image/upload/c_fit,h_60,w_60/v1793205819/orbix/brand/orbix_logo_gray.png" 
                         alt="Orbix" 
                         width="14" 
                         height="14" 
                         style="display: block; width: 14px; height: 14px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td style="vertical-align: middle; font-size: 11px; font-weight: 700; color: #888888; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Orbix • Unified Developer Identity & Analytics
                  </td>
                </tr>
              </table>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #AAAAAA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Automated security message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

          <!-- Bottom Desk Shelf Illustration -->
          <tr>
            <td align="center" style="padding: 0; line-height: 0; font-size: 0; background-color: #FAFAFA; text-align: center;">
              <img src="https://res.cloudinary.com/dj0ivep44/image/upload/v1793203068/98898242-5f9b-4587-afc3-c1b298d918d7.png" 
                   alt="Orbix Workspace" 
                   width="520" 
                   style="display: block; width: 100%; max-width: 520px; height: auto; border: 0; margin: 0 auto; outline: none; text-decoration: none;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends an email verification code using the multi-provider dispatcher (Resend / SMTP).
 */
export async function sendVerificationEmail(
  options: SendVerificationEmailOptions,
  deps?: EmailDispatchDeps
): Promise<SendEmailResult> {
  const { to, name = "Developer", otp } = options;
  const html = generateVerificationEmailHtml({ name, otp, email: to });
  const text = `Hello ${name},\n\nYour Orbix account verification code is: ${otp}\n\nThis code expires in 10 minutes.`;

  return dispatchEmail({
    to,
    subject: `Orbix Verification Code: ${otp}`,
    html,
    text,
    fromName: "Orbix Team",
    defaultFromEmail: "onboarding@resend.dev",
    logContext: "Verification email",
  }, deps);
}

/**
 * Sends a security notification or authorization OTP email using the multi-provider dispatcher (Resend / SMTP).
 */
export async function sendSecurityNotificationEmail(options: SendSecurityNotificationEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    name = "Developer",
    subject,
    badgeText = "Security Notice",
    headline,
    message,
    otp,
    otpLabel = "Verification Code",
    isWarning = false,
    footerNotice = "If you did not request this action, please secure your account immediately."
  } = options;

  const html = generateSecurityNotificationHtml({
    name,
    headline,
    message,
    subject,
    badgeText,
    isWarning,
    otp,
    otpLabel,
    footerNotice,
  });

  const text = `Hello ${name},\n\n${headline}\n\n${message}${otp ? `\n\nCode: ${otp} (Expires in 10 minutes)` : ""}\n\n${footerNotice}`;

  return dispatchEmail({
    to,
    subject,
    html,
    text,
    fromName: "Orbix Security",
    defaultFromEmail: "onboarding@resend.dev",
    logContext: "Security notification",
  });
}


export interface SendGuardianConsentEmailOptions {
  to: string;
  guardianName: string;
  studentName: string;
  eventTitle: string;
  clubName: string;
  collegeName: string;
  consentLink: string;
  expiresInDays?: number;
}

/**
 * Sends verifiable electronic consent request email to parent or legal guardian for a minor attendee.
 */
export async function sendGuardianConsentEmail(options: SendGuardianConsentEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    guardianName,
    studentName,
    eventTitle,
    clubName,
    collegeName,
    consentLink,
    expiresInDays = 7,
  } = options;

  const subject = `Parental Consent Required: ${studentName} - ${eventTitle}`;
  const message = `Your dependent, <strong>${studentName}</strong>, has registered to attend the collegiate event <strong>"${eventTitle}"</strong> organized by <strong>${clubName}</strong> at <strong>${collegeName}</strong>. In accordance with applicable minor data protection standards and the Orbix Platform Terms, verifiable parental or guardian consent is legally required before participation and student registration can be confirmed.<br><br>Please click the secure button below to review event details, data processing provisions, and electronically record your consent:`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4F4F0; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FAF6EE; border: 3px solid #000000; box-shadow: 6px 6px 0px 0px #000000; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background-color: #000000; padding: 20px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase;">ORBIX</span>
                  </td>
                  <td align="right">
                    <span style="background-color: #FFE566; color: #000000; padding: 4px 10px; border-radius: 999px; border: 1.5px solid #000000; font-size: 11px; font-weight: 900; text-transform: uppercase;">Minor Protection</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 900; color: #000000;">Parental / Guardian Consent Request</h1>
              <p style="font-size: 14px; line-height: 1.6; color: #333333;">Dear <strong>${guardianName}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #333333;">${message}</p>
              
              <div style="background-color: #FFFFFF; border: 2px solid #000000; padding: 16px; margin: 20px 0; border-radius: 6px; box-shadow: 3px 3px 0px 0px #000000;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #555555;"><strong>Event:</strong> ${eventTitle}</p>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #555555;"><strong>Host Club:</strong> ${clubName}</p>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #555555;"><strong>Campus:</strong> ${collegeName}</p>
                <p style="margin: 0; font-size: 13px; color: #555555;"><strong>Attendee:</strong> ${studentName} (Under 18)</p>
              </div>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${consentLink}" style="display: inline-block; background-color: #a2ff86; color: #000000; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; text-decoration: none; padding: 14px 28px; border: 2.5px solid #000000; border-radius: 6px; box-shadow: 4px 4px 0px 0px #000000;">Review & Record Guardian Consent</a>
              </div>

              <p style="font-size: 12px; line-height: 1.5; color: #666666; border-top: 1px solid #DDDDDD; padding-top: 16px;">
                This link will expire in ${expiresInDays} days. If you do not recognize this request or wish to decline participation, you may decline directly on the verification page or ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #F0EDE6; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #777777;">Orbix Platform • Digital Identity & Collegiate Chapter Network</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hello ${guardianName},\n\nYour dependent, ${studentName}, has registered for "${eventTitle}" at ${collegeName} hosted by ${clubName}.\n\nVerifiable parental/guardian consent is required. Please review and confirm consent at the following link:\n${consentLink}\n\nLink expires in ${expiresInDays} days.`;

  return dispatchEmail({
    to,
    subject,
    html,
    text,
    fromName: "Orbix Minor Protection",
    defaultFromEmail: "onboarding@resend.dev",
    logContext: "Guardian consent verification",
  });
}

export interface SendPasswordResetOtpEmailOptions {
  to: string;
  name?: string;
  otp: string;
  accountType?: string;
}

/**
 * Dispatches a high-security OTP email for password reset verification.
 */
export async function sendPasswordResetOtpEmail(options: SendPasswordResetOtpEmailOptions): Promise<SendEmailResult> {
  const { to, name = "Developer", otp, accountType = "personal" } = options;
  const isClub = accountType === "club";
  const entityLabel = isClub ? "Club Account" : "Orbix Account";

  return sendSecurityNotificationEmail({
    to,
    name,
    subject: `Your Orbix Password Reset Code: ${otp}`,
    badgeText: isClub ? "Club Account Recovery" : "Account Recovery",
    headline: `Reset your ${entityLabel} password`,
    message: `We received a request to reset the password for your ${entityLabel}. Use the 6-digit verification code below to verify your identity and set a new secure password.`,
    otp,
    otpLabel: "6-Digit Verification Code",
    isWarning: true,
    footerNotice: "This verification code will expire in 10 minutes. If you did not make this request, your account is still secure — no password change can occur without this code. You may safely ignore this email.",
  });
}

/**
 * Dispatches an account security confirmation email after successful password change.
 */
export async function sendPasswordResetSuccessEmail(options: {
  to: string;
  name?: string;
  accountType?: string;
  ipAddressMasked?: string;
}): Promise<SendEmailResult> {
  const { to, name = "Developer", accountType = "personal", ipAddressMasked = "Unknown IP" } = options;
  const isClub = accountType === "club";
  const entityLabel = isClub ? "Club Account" : "Personal Account";

  return sendSecurityNotificationEmail({
    to,
    name,
    subject: `Security Alert: Your Orbix Password Was Changed`,
    badgeText: "Security Alert",
    headline: `Password Changed Successfully`,
    message: `The password for your Orbix ${entityLabel} (${to}) was successfully reset from ${ipAddressMasked}. For your security, all other existing active sessions and devices have been logged out.`,
    isWarning: false,
    footerNotice: "If you did not perform this password reset, please contact Orbix security immediately at support@orbix.dev to protect your account.",
  });
}




export interface SendHelpTicketCreatedEmailOptions {
  to: string;
  name?: string;
  ticketNumber: string;
  category: "bug_report" | "sync_issue" | "college_verification" | "feature_request" | "general_inquiry" | string;
  subject: string;
  description: string;
  priority?: string;
  attachmentUrl?: string | null;
  createdAt?: string | Date;
}

/**
 * Builds the empathetic and caring HTML confirmation email template for Help Center tickets.
 */
function buildHelpTicketCreatedEmailTemplate(options: SendHelpTicketCreatedEmailOptions) {
  const {
    name = "Developer",
    ticketNumber,
    category,
    subject,
    description,
    priority = "normal",
    attachmentUrl,
    createdAt = new Date(),
  } = options;

  const safeName = String(name || "Developer").replace(/[<>&"]/g, "");
  const safeSubject = String(subject || "").replace(/[<>&"]/g, "");
  const safeTicket = String(ticketNumber || "").replace(/[<>&"]/g, "");
  const safeDesc = String(description || "").replace(/[<>&"]/g, "");
  const formattedDate = new Date(createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let categoryLabel = "General Support";
  let badgeColor = "#FFE566";
  let badgeText = "SUPPORT TICKET";
  let headline = "We've Received Your Support Request";
  let empathyMessage = `Hello <strong>${safeName}</strong>,<br/><br/>Thank you for reaching out to Orbix Support. We're here to ensure you have the smoothest experience possible.<br/><br/>Our engineering and support team has logged your inquiry and is reviewing the details you shared.`;

  if (category === "bug_report") {
    categoryLabel = "Bug Report";
    badgeColor = "#FFE566";
    badgeText = "BUG REPORT ACKNOWLEDGED";
    headline = "We're On It — Thank You for Catching This!";
    empathyMessage = `Hello <strong>${safeName}</strong>,<br/><br/>First and foremost, <strong>thank you so much</strong> for taking the time to report this issue. Software engineering is a continuous craft of refinement, and thoughtful bug reports like yours help make Orbix faster, smoother, and more reliable for every developer in our community.<br/><br/>Please rest assured: our engineering team has received your report along with auto-attached system diagnostics. We are actively investigating the root cause to put a fix into production. You're in good hands, and we truly appreciate your patience and help!`;
  } else if (category === "sync_issue") {
    categoryLabel = "Platform Sync & Stats";
    badgeColor = "#a2ff86";
    badgeText = "SYNC DIAGNOSTICS QUEUED";
    headline = "We're Inspecting Your Coding Stats & Ratings";
    empathyMessage = `Hello <strong>${safeName}</strong>,<br/><br/>We understand how much hard work and dedication goes into your competitive programming streaks, contest ratings, and practice problem milestones. We treat data integrity as our top priority.<br/><br/>Our sync monitoring workers are checking the platform feeds for your account, and we will make sure your stats, rating graphs, and badges are properly reconciled.`;
  } else if (category === "college_verification") {
    categoryLabel = "College & Club Chapter";
    badgeColor = "#93c5fd";
    badgeText = "COLLEGE REVIEW";
    headline = "Your College & Chapter Inquiry Is Being Reviewed";
    empathyMessage = `Hello <strong>${safeName}</strong>,<br/><br/>Thank you for reaching out regarding university chapter or collegiate verification. We love supporting student developer communities!<br/><br/>Our academic review team is checking your details and credentials to help you get your campus community connected.`;
  } else if (category === "feature_request") {
    categoryLabel = "Feature Suggestion";
    badgeColor = "#fbcfe8";
    badgeText = "PRODUCT PROPOSAL";
    headline = "Love This Idea! It's Reached Our Product Team";
    empathyMessage = `Hello <strong>${safeName}</strong>,<br/><br/>The most impactful features on Orbix come directly from engineers like you who use the platform every day.<br/><br/>We have forwarded your suggestion straight to our core product roadmap board. Thank you for helping shape the future of Orbix!`;
  }

  const emailSubject = `[Ticket #${safeTicket}] ${headline} — Orbix Support`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 2.5px solid #000000; border-radius: 16px; box-shadow: 5px 5px 0px #000000; overflow: hidden; border-collapse: separate;" cellspacing="0" cellpadding="0">
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #000000; padding: 20px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 10px; line-height: 0;">
                          <img src="https://res.cloudinary.com/bh1mhiwb/image/upload/c_fit,h_120,w_120/v1793205819/orbix/brand/orbix_logo_green.png" 
                               alt="Orbix Logo" 
                               width="26" 
                               height="26" 
                               style="display: block; width: 26px; height: 26px; border: 0;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 19px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase;">
                            ORBIX SUPPORT
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: ${badgeColor}; color: #000000; font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; border: 1.5px solid #000000;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 900; line-height: 1.3; color: #000000; letter-spacing: -0.5px;">
                ${headline}
              </h1>

              <div style="font-size: 14px; line-height: 1.65; color: #222222; margin-bottom: 24px;">
                ${empathyMessage}
              </div>

              <!-- Ticket Summary Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; box-shadow: 3px 3px 0px #000000; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1.5px solid rgba(0,0,0,0.15); background-color: #F2ECE0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #666666;">
                            Ticket Reference
                          </span>
                          <div style="font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 16px; font-weight: 900; color: #000000;">
                            #${safeTicket}
                          </div>
                        </td>
                        <td align="right">
                          <span style="display: inline-block; font-size: 11px; font-weight: 900; padding: 3px 8px; border-radius: 6px; border: 1px solid #000000; background-color: #FFFFFF; text-transform: uppercase;">
                            ${priority} Priority
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; font-size: 13px; line-height: 1.6; color: #111111;">
                    <div style="margin-bottom: 8px;">
                      <strong>Subject:</strong> ${safeSubject}
                    </div>
                    <div style="margin-bottom: 8px;">
                      <strong>Category:</strong> ${categoryLabel}
                    </div>
                    <div style="margin-bottom: 8px;">
                      <strong>Logged At:</strong> ${formattedDate}
                    </div>
                    ${attachmentUrl ? `
                    <div style="margin-top: 10px; padding: 8px 12px; background-color: #FFFFFF; border: 1.5px solid #000000; border-radius: 8px; font-size: 12px;">
                      📎 <strong>Attachment:</strong> <a href="${attachmentUrl}" target="_blank" style="color: #0284c7; font-weight: bold; text-decoration: underline;">View Uploaded Screenshot</a>
                    </div>` : ""}
                  </td>
                </tr>
              </table>

              <!-- 5-Stage Live Resolution Journey -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #555555; margin-bottom: 10px;">
                  Resolution Journey
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 2px solid #000000; border-radius: 12px; background-color: #FFFFFF; padding: 14px 18px; box-shadow: 2px 2px 0px #000000;">
                  <tr>
                    <td style="font-size: 12px; line-height: 1.8; color: #222222;">
                      <div style="font-weight: 900; color: #15803d;">
                        ✅ Stage 1: Received & Logged (Completed)
                      </div>
                      <div style="font-weight: 800; color: #0284c7;">
                        🔄 Stage 2: Triaging & Root Cause Analysis (Current)
                      </div>
                      <div style="color: #666666;">
                        ⏳ Stage 3: Engineering Fix in Development
                      </div>
                      <div style="color: #666666;">
                        🧪 Stage 4: Verification & Regression Testing
                      </div>
                      <div style="color: #666666;">
                        🎉 Stage 5: Fix Deployed & Ticket Closed
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Reassuring Note & Dashboard Call to Action -->
              <div style="padding: 16px; background-color: #FAF6EE; border-left: 4px solid #000000; border-radius: 6px; font-size: 12.5px; line-height: 1.6; color: #333333; margin-bottom: 24px;">
                <strong>What happens next?</strong> You don't need to do anything right now. As our team works through the ticket, any status updates, questions, or fixes will be sent to your email and updated live in your <strong>Settings &gt; Help Center &gt; My Tickets</strong> dashboard.
              </div>

              <div style="font-size: 13px; line-height: 1.6; color: #444444;">
                With care and dedication,<br/>
                <strong style="color: #000000;">The Orbix Engineering & Support Team</strong>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px; background-color: #F0EDE6; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #777777; font-weight: 700;">
                Orbix Support • Zero Password Sync • 24/7 Developer Reliability
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hello ${safeName},\n\n${headline}\n\n${category === "bug_report" ? "Thank you for reporting this issue! Software engineering is a continuous craft of refinement, and your report helps make Orbix better for everyone." : "We have received your support request and our team is actively reviewing it."}\n\nTicket Reference: #${safeTicket}\nSubject: ${safeSubject}\nCategory: ${categoryLabel}\nPriority: ${priority}\nLogged At: ${formattedDate}\n${attachmentUrl ? `Attachment: ${attachmentUrl}\n` : ""}\nResolution Journey:\n1. [DONE] Stage 1: Received & Logged\n2. [ACTIVE] Stage 2: Triaging & Root Cause Analysis\n3. Stage 3: Engineering Fix in Development\n4. Stage 4: Verification & Testing\n5. Stage 5: Fix Deployed & Closed\n\nYou can track live progress anytime in your Orbix dashboard under Settings > Help Center > My Tickets.\n\nWith care,\nThe Orbix Engineering Team`;

  return { subject: emailSubject, headline, html, text };
}

/**
 * Sends a warm, empathetic Help Center ticket confirmation email to the user.
 */
export async function sendHelpTicketCreatedEmail(
  options: SendHelpTicketCreatedEmailOptions,
  deps?: EmailDispatchDeps
): Promise<SendEmailResult> {
  const { to } = options;
  const template = buildHelpTicketCreatedEmailTemplate(options);

  return dispatchEmail(
    {
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      fromName: "Orbix Support Team",
      defaultFromEmail: "onboarding@resend.dev",
      logContext: `Help Center ticket created #${options.ticketNumber}`,
    },
    deps
  );
}

export { OnboardingEmailService } from "./onboardingEmailService.js";
export type {
  SendPersonalWelcomeEmailOptions,
  SendClubApplicationReceivedEmailOptions,
  SendClubApplicationStaffAlertEmailOptions,
  SendClubVerifiedEmailOptions,
  SendClubVerifiedStaffAlertEmailOptions,
} from "./onboardingEmailService.js";
