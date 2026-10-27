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
            <td style="padding: 18px 28px 24px 28px; border-top: 1px solid #EEEEEE; background-color: #FAFAFA; text-align: center;">
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
