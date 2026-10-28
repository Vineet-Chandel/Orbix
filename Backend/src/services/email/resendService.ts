import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

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
  simulated?: boolean;
  messageId?: string;
  error?: string;
  provider?: "resend" | "smtp" | "simulation";
  sandboxRestricted?: boolean;
}

let resendClientInstance: Resend | null = null;
let smtpTransporterInstance: Transporter | null = null;

/**
 * Returns an authenticated Resend client instance if RESEND_API_KEY is configured.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your_resend_api_key")) {
    return null;
  }
  if (!resendClientInstance) {
    resendClientInstance = new Resend(apiKey.trim());
  }
  return resendClientInstance;
}

/**
 * Returns a configured Nodemailer SMTP transporter if SMTP credentials are provided.
 * Supports standard SMTP (Gmail App Passwords, SendGrid, Amazon SES, Brevo, custom SMTP).
 */
export function getSmtpTransporter(): Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass || !user.trim() || !pass.trim()) {
    return null;
  }

  if (!smtpTransporterInstance) {
    const host = process.env.SMTP_HOST || (user.includes("@gmail.com") ? "smtp.gmail.com" : "localhost");
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

    smtpTransporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, ""), // clean accidental spaces in app passwords
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
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
  transporter: Transporter,
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
      provider: "smtp",
      messageId: info.messageId,
    };
  } catch (smtpErr: any) {
    console.error(`[SMTP Error] Failed sending email to ${to}:`, smtpErr.message || smtpErr);
    return {
      success: false,
      provider: "smtp",
      error: smtpErr.message || "Failed to dispatch email via SMTP",
    };
  }
}

interface DispatchEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  defaultFromEmail: string;
  logContext: string;
}

/**
 * Unified Multi-Provider Email Dispatcher.
 * Intelligently chooses between Resend API, Nodemailer SMTP, and dev simulation.
 * Automatically fails over to SMTP if Resend sandbox restricts non-owner destinations.
 */
async function dispatchEmail(payload: DispatchEmailPayload): Promise<SendEmailResult> {
  const { to, subject, html, text, fromName, defaultFromEmail, logContext } = payload;
  const normalizedTo = to.trim().toLowerCase();

  const resendClient = getResendClient();
  const smtpTransporter = getSmtpTransporter();
  const providerPref = (process.env.EMAIL_PROVIDER || "auto").toLowerCase();

  // 0. Simulation Mode: Neither Resend nor SMTP is configured
  if (!resendClient && !smtpTransporter) {
    console.log(`\n======================================================`);
    console.log(`[EMAIL DISPATCHER] ⚠️ Neither Resend API key nor SMTP credentials configured.`);
    console.log(`[DEV MODE SIMULATION] ${logContext} to ${normalizedTo}: ${subject}`);
    console.log(`======================================================\n`);

    return {
      success: true,
      simulated: true,
      provider: "simulation",
      messageId: `simulated_${Date.now()}`,
    };
  }

  // 1. Explicit SMTP preference
  if (providerPref === "smtp" && smtpTransporter) {
    return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
  }

  // 2. Resend API Flow
  if (resendClient && providerPref !== "smtp") {
    const customFromEmail = process.env.RESEND_FROM_EMAIL;
    const isCustomDomain = Boolean(customFromEmail && !customFromEmail.includes("@resend.dev"));

    // If using Resend sandbox (@resend.dev), it only delivers to the owner's email or internal @resend.dev test emails
    const isResendInternalTestAddress = normalizedTo.endsWith("@resend.dev");

    // Proactive SMTP routing: If destination is outside sandbox and SMTP is configured, route directly via SMTP!
    if (!isCustomDomain && !isResendInternalTestAddress && smtpTransporter) {
      console.log(`[Email Dispatcher] Target (${normalizedTo}) is outside Resend sandbox. Routing directly via SMTP...`);
      return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
    }

    try {
      const from = customFromEmail || `${fromName} <${defaultFromEmail}>`;
      const { data, error } = await resendClient.emails.send({
        from,
        to: [normalizedTo],
        subject,
        html,
        text,
      });

      if (error) {
        const errorMsg = error.message || "Failed to dispatch via Resend";
        console.error(`[Resend API Error]:`, error);

        // If trial sandbox limitation error:
        if (isResendSandboxError(errorMsg)) {
          // Immediate automated fallback to SMTP if configured
          if (smtpTransporter) {
            console.log(`[Email Dispatcher] Resend sandbox restriction encountered. Automatically failing over to SMTP for ${normalizedTo}...`);
            return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
          }

          // Otherwise log detailed guidance
          console.warn(`\n======================================================`);
          console.warn(`[EMAIL DELIVERY LIMITATION: RESEND SANDBOX MODE]`);
          console.warn(`Recipient: ${normalizedTo}`);
          console.warn(`Reason: Resend test sandbox only permits sending to the account owner email.`);
          console.warn(`To deliver live emails to any recipient in production:`);
          console.warn(`  Option 1 (SMTP/Gmail): Add to Backend/.env:`);
          console.warn(`     SMTP_USER=your_email@gmail.com`);
          console.warn(`     SMTP_PASS=your_16_char_google_app_password`);
          console.warn(`  Option 2 (Resend Custom Domain): Verify domain at resend.com/domains and set:`);
          console.warn(`     RESEND_FROM_EMAIL=Orbix Security <support@yourdomain.com>`);
          console.warn(`======================================================\n`);

          return {
            success: false,
            sandboxRestricted: true,
            provider: "resend",
            error: errorMsg,
          };
        }

        // If non-sandbox error and SMTP is available, attempt fallback
        if (smtpTransporter) {
          console.log(`[Email Dispatcher] Resend error (${errorMsg}). Attempting fallback to SMTP...`);
          return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
        }

        return {
          success: false,
          provider: "resend",
          error: errorMsg,
        };
      }

      console.log(`[Resend API] ${logContext} sent successfully to ${normalizedTo} (ID: ${data?.id})`);
      return {
        success: true,
        provider: "resend",
        messageId: data?.id,
      };
    } catch (resendEx: any) {
      console.error(`[Resend Exception]:`, resendEx);
      if (smtpTransporter) {
        console.log(`[Email Dispatcher] Resend exception. Failing over to SMTP...`);
        return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
      }
      return {
        success: false,
        provider: "resend",
        error: resendEx.message || "Internal error sending email via Resend",
      };
    }
  }

  // 3. SMTP-Only Flow
  if (smtpTransporter) {
    return sendViaSmtp(smtpTransporter, { to: normalizedTo, subject, html, text, fromName });
  }

  return {
    success: false,
    error: "No usable email transport configured.",
  };
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
                    <!-- Orbix Brand with Lucide Terminal SVG -->
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 8px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a2ff86" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polyline points="4 17 10 11 4 5"></polyline>
                            <line x1="12" y1="19" x2="20" y2="19"></line>
                          </svg>
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase;">
                            ORBIX
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <!-- Pill with Lucide ShieldCheck SVG -->
                    <span style="background-color: #FFE566; color: #000000; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; box-shadow: 1px 1px 0px #000000; display: inline-block;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align: middle; padding-right: 5px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
                              <path d="m9 12 2 2 4-4"></path>
                            </svg>
                          </td>
                          <td style="vertical-align: middle; font-size: 11px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">
                            Verify Account
                          </td>
                        </tr>
                      </table>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Content -->
          <tr>
            <td style="padding: 32px 28px 28px 28px;">
              <!-- Neo-Brutalist Lucide Mail Hero Icon Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center" style="width: 50px; height: 50px; background-color: #FFE566; border: 2px solid #000000; border-radius: 12px; box-shadow: 3px 3px 0px #000000; text-align: center; vertical-align: middle;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: auto;">
                      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path>
                    </svg>
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

          <!-- Footer with Lucide Terminal SVG -->
          <tr>
            <td style="padding: 18px 28px 14px 28px; border-top: 1px solid #EEEEEE; background-color: #FAFAFA; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                      <polyline points="4 17 10 11 4 5"></polyline>
                      <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                  </td>
                  <td style="vertical-align: middle; font-size: 11px; font-weight: 700; color: #888888;">
                    Orbix • Unified Developer Identity & Analytics
                  </td>
                </tr>
              </table>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #AAAAAA;">
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
                    <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase;">
                      ORBIX
                    </span>
                  </td>
                  <td align="right">
                    <span style="background-color: ${headerBadgeBg}; color: ${headerBadgeText}; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
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

          <!-- Footer with Lucide Terminal SVG -->
          <tr>
            <td style="padding: 18px 28px 14px 28px; border-top: 1px solid #EEEEEE; background-color: #FAFAFA; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                      <polyline points="4 17 10 11 4 5"></polyline>
                      <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                  </td>
                  <td style="vertical-align: middle; font-size: 11px; font-weight: 700; color: #888888;">
                    Orbix • Unified Developer Identity & Analytics
                  </td>
                </tr>
              </table>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #AAAAAA;">
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
export async function sendVerificationEmail(options: SendVerificationEmailOptions): Promise<SendEmailResult> {
  const { to, name = "Developer", otp } = options;
  const html = generateVerificationEmailHtml({ name, otp, email: to });
  const text = `Hello ${name},\n\nYour Orbix account verification code is: ${otp}\n\nThis code expires in 10 minutes.`;

  return dispatchEmail({
    to,
    subject: `Orbix Verification Code: ${otp}`,
    html,
    text,
    fromName: "Orbix",
    defaultFromEmail: "onboarding@resend.dev",
    logContext: "Verification email",
  });
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
