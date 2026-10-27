import { Resend } from "resend";

interface SendVerificationEmailOptions {
    to: string;
    name?: string;
    otp: string;
}

interface SendEmailResult {
    success: boolean;
    simulated?: boolean;
    messageId?: string;
    error?: string;
}

let resendClientInstance: Resend | null = null;

/**
 * Returns an authenticated Resend client instance if RESEND_API_KEY is configured.
 */
function getResendClient(): Resend | null {
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
                    <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #a2ff86; text-transform: uppercase;">
                      ORBIX
                    </span>
                  </td>
                  <td align="right">
                    <span style="background-color: #FFE566; color: #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; border: 1.5px solid #FFFFFF;">
                      Verify Account
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 900; color: #000000; letter-spacing: -0.5px;">
                Confirm Your Email Address
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #444444; font-weight: 500;">
                Hello <strong style="color: #000000;">${recipientName}</strong>, use the single-use 6-digit verification code below to verify <strong style="color: #000000;">${email}</strong> for your Orbix account.
              </p>

              <!-- Neo-Brutalist Code Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0 8px 0;">
                <tr>
                  <td align="center" style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 14px; box-shadow: 3px 3px 0px #000000; padding: 24px 16px;">
                    <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #666666; margin-bottom: 8px;">
                      Verification Code
                    </div>
                    <div style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #000000; line-height: 1.2;">
                      ${otp}
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #555555; margin-top: 10px;">
                      ⏱ Expires in 10 minutes • Valid for one attempt
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px 24px 28px; border-top: 1px solid #EEEEEE; background-color: #FAFAFA; text-align: center;">
              <p style="margin: 0; font-size: 11px; font-weight: 700; color: #888888;">
                Orbix • Unified Developer Identity & Analytics
              </p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #AAAAAA;">
                Automated security message. Please do not reply directly to this email.
              </p>
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
 * Sends an email verification code using Resend.
 * In development or if RESEND_API_KEY is unset, logs the code to console and simulates success.
 */
export async function sendVerificationEmail(options: SendVerificationEmailOptions): Promise<SendEmailResult> {
    const { to, name = "Developer", otp } = options;
    const client = getResendClient();

    if (!client) {
        console.log(`\n======================================================`);
        console.log(`[RESEND EMAIL SERVICE] ⚠️ RESEND_API_KEY not configured.`);
        console.log(`[DEV MODE SIMULATION] Verification OTP for ${to}:`);
        console.log(`>>> OTP: ${otp} <<<`);
        console.log(`======================================================\n`);

        return {
            success: true,
            simulated: true,
            messageId: `simulated_${Date.now()}`,
        };
    }

    try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "Orbix <onboarding@resend.dev>";
        const html = generateVerificationEmailHtml({ name, otp, email: to });
        const text = `Hello ${name},\n\nYour Orbix account verification code is: ${otp}\n\nThis code expires in 10 minutes.`;

        const { data, error } = await client.emails.send({
            from: fromEmail,
            to: [to],
            subject: `Orbix Verification Code: ${otp}`,
            html,
            text,
        });

        if (error) {
            console.error("[Resend API Error]:", error);
            return {
                success: false,
                error: error.message || "Failed to send email via Resend",
            };
        }

        console.log(`[Resend API] Verification email sent successfully to ${to} (ID: ${data?.id})`);
        return {
            success: true,
            messageId: data?.id,
        };
    } catch (err: any) {
        console.error("[Resend Exception]:", err);
        return {
            success: false,
            error: err.message || "Internal error sending email",
        };
    }
}
