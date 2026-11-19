// Backend/src/services/email/onboardingEmailService.ts
import { dispatchEmail, type SendEmailResult } from "./resendService.js";

const DEFAULT_FOUNDER_FROM = process.env.FOUNDER_FROM_EMAIL || "Vineet <vineet@vineetchandel.in>";
const DEFAULT_FOUNDER_REPLY_TO = process.env.FOUNDER_REPLY_EMAIL || "vineet@vineetchandel.in";
const DEFAULT_SYSTEM_FROM = process.env.RESEND_FROM_EMAIL || "team@vineetchandel.in";

function getFrontendBaseUrl(): string {
    const rawUrl = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "https://orbix.campus";
    return rawUrl.replace(/\/+$/, "");
}

function getStaffNotificationEmail(): string {
    return process.env.ORBIX_ADMIN_EMAIL || process.env.STAFF_NOTIFICATION_EMAIL || "team@vineetchandel.in";
}

// In-memory idempotency deduplication cache (1-hour window)
const recentDispatches = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isDuplicateDispatch(key: string): boolean {
    const now = Date.now();
    const lastSent = recentDispatches.get(key);
    if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
        return true;
    }
    recentDispatches.set(key, now);
    // Cleanup old keys periodically
    if (recentDispatches.size > 2000) {
        for (const [k, ts] of recentDispatches.entries()) {
            if (now - ts >= DEDUP_WINDOW_MS) {
                recentDispatches.delete(k);
            }
        }
    }
    return false;
}

export interface SendPersonalWelcomeEmailOptions {
    to: string;
    firstName?: string;
    username?: string;
    userId?: string;
}

export interface SendClubApplicationReceivedEmailOptions {
    to: string;
    contactPersonName: string;
    clubName: string;
    collegeName: string;
    clubCategory?: string;
    requestId?: string;
}

export interface SendClubApplicationStaffAlertEmailOptions {
    clubName: string;
    clubCategory: string;
    collegeName: string;
    collegeCity?: string;
    collegeState?: string;
    contactPersonName: string;
    contactPersonRole: string;
    contactEmail: string;
    contactPhone?: string;
    collegeOfficialEmail?: string;
    clubWebsiteUrl?: string;
    submittedAt?: string | Date;
    requestId: string;
}

export interface SendClubVerifiedEmailOptions {
    to: string;
    contactPersonName: string;
    clubName: string;
    collegeName: string;
    slug: string;
    clubId?: string;
}

export interface SendClubVerifiedStaffAlertEmailOptions {
    clubName: string;
    collegeName: string;
    slug: string;
    contactPersonName: string;
    contactEmail: string;
    reviewedBy?: string;
    verifiedAt?: string | Date;
}

export class OnboardingEmailService {
    /**
     * 1. PERSONAL USER REGISTRATION WELCOME EMAIL
     * Sent immediately when a user creates a personal developer account.
     */
    static async sendPersonalWelcomeEmail(options: SendPersonalWelcomeEmailOptions): Promise<SendEmailResult> {
        const { to, firstName, username, userId } = options;
        const recipientEmail = to.trim().toLowerCase();
        const recipientFirstName = firstName && firstName.trim() ? firstName.trim() : (username ? username : "Developer");
        const dedupKey = `welcome:personal:${recipientEmail}`;

        if (isDuplicateDispatch(dedupKey)) {
            console.log(`[ONBOARDING EMAIL] ⏭️ Skipped duplicate welcome email to ${recipientEmail}`);
            return { success: true, simulated: true, messageId: "skipped_duplicate" };
        }

        const frontendUrl = getFrontendBaseUrl();
        const profileUrl = `${frontendUrl}/profile`;
        const accountsUrl = `${frontendUrl}/profile/edit`;
        const exploreUrl = `${frontendUrl}/explore`;

        const subject = `Welcome to Orbix!`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Orbix!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 16px; box-shadow: 4px 4px 0px #000000; overflow: hidden; border-collapse: separate;" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #000000; padding: 18px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
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
                            ORBIX
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="background-color: #FFE566; color: #000000; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; box-shadow: 1px 1px 0px #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                      Welcome
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 900; color: #000000; letter-spacing: -0.5px; line-height: 1.3;">
                Hey ${recipientFirstName},
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #222222; font-weight: 500;">
                Welcome to Orbix!
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
                I'm <strong>Vineet Chandel</strong>, the founder of Orbix, and I'm genuinely glad to have you here.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #333333;">
                We started Orbix with one simple vision: <strong>to bring the entire developer ecosystem together in one place</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Whether you're solving coding challenges, building projects, participating in hackathons, exploring events, or connecting with fellow developers, Orbix is here to make your developer journey more meaningful.
              </p>

              <!-- Section: 3 Things to do first -->
              <div style="margin: 28px 0 24px 0; border-top: 2px dashed #000000; padding-top: 24px;">
                <h2 style="margin: 0 0 18px 0; font-size: 15px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">
                  Here are 3 things I'd recommend doing first:
                </h2>

                <!-- Step 1 Card -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 15px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    1. Build your developer identity
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Complete your profile and showcase your skills, achievements, experience, and projects.
                  </p>
                  <a href="${profileUrl}" target="_blank" style="background-color: #a2ff86; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Complete Your Profile
                  </a>
                </div>

                <!-- Step 2 Card -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 15px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    2. Connect your developer accounts
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Connect platforms like GitHub, LeetCode, Codeforces, CodeChef, and more to bring your coding journey together.
                  </p>
                  <a href="${accountsUrl}" target="_blank" style="background-color: #FFE566; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Connect Your Accounts
                  </a>
                </div>

                <!-- Step 3 Card -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 8px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 15px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    3. Explore the Orbix ecosystem
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Discover events, showcase your projects, connect with communities, and explore exciting opportunities.
                  </p>
                  <a href="${exploreUrl}" target="_blank" style="background-color: #70D6FF; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Explore Orbix
                  </a>
                </div>
              </div>

              <!-- Question from Founder Box -->
              <div style="background-color: #FFF9E6; border: 2px solid #000000; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 3px 3px 0px #000000;">
                <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #855800; letter-spacing: 1px; margin-bottom: 8px;">
                  One thing I'd love to know...
                </div>
                <div style="font-size: 16px; font-weight: 900; color: #000000; margin-bottom: 8px;">
                  What brought you to Orbix?
                </div>
                <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.6; color: #333333;">
                  Are you here to improve your coding skills, showcase your projects, discover opportunities, connect with developers, or something else?
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #000000; font-weight: 700;">
                  Just hit <span style="background-color: #FFE566; padding: 2px 6px; border: 1px solid #000000; border-radius: 4px;">Reply</span> and tell me. I personally love hearing from people who are part of what we're building.
                </p>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Orbix is still growing, and we're building it with the developer community in mind. Your feedback, ideas, and experiences genuinely matter.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #000000; font-weight: 700;">
                Looking forward to seeing what you build!
              </p>

              <!-- Founder Signature -->
              <div style="border-top: 2px solid #000000; padding-top: 18px; margin-top: 24px;">
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #444444; font-weight: 500;">Cheers,</p>
                <p style="margin: 0; font-size: 17px; font-weight: 900; color: #000000;">Vineet Chandel</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 700; color: #444444;">Founder, Orbix</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #666666; font-style: italic;">An Ecosystem for Developers</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF6EE; border-top: 2px solid #000000; padding: 18px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #777777;">
                Sent by <strong>Orbix</strong> • Reply directly to this email to reach founder Vineet Chandel.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const text = `Hey ${recipientFirstName},

Welcome to Orbix!

I'm Vineet Chandel, the founder of Orbix, and I'm genuinely glad to have you here.

We started Orbix with one simple vision: to bring the entire developer ecosystem together in one place.

Whether you're solving coding challenges, building projects, participating in hackathons, exploring events, or connecting with fellow developers, Orbix is here to make your developer journey more meaningful.

Here are 3 things I'd recommend doing first:

1. Build your developer identity
Complete your profile and showcase your skills, achievements, experience, and projects.
→ Complete Your Profile: ${profileUrl}

2. Connect your developer accounts
Connect platforms like GitHub, LeetCode, Codeforces, CodeChef, and more to bring your coding journey together.
→ Connect Your Accounts: ${accountsUrl}

3. Explore the Orbix ecosystem
Discover events, showcase your projects, connect with communities, and explore exciting opportunities.
→ Explore Orbix: ${exploreUrl}

One thing I'd love to know...

What brought you to Orbix?

Are you here to improve your coding skills, showcase your projects, discover opportunities, connect with developers, or something else?

Just hit Reply and tell me. I personally love hearing from people who are part of what we're building.

Orbix is still growing, and we're building it with the developer community in mind. Your feedback, ideas, and experiences genuinely matter.

Looking forward to seeing what you build!

Cheers,

Vineet Chandel
Founder, Orbix
An Ecosystem for Developers`;

        return dispatchEmail({
            to: recipientEmail,
            subject,
            html,
            text,
            customFrom: DEFAULT_FOUNDER_FROM,
            replyTo: DEFAULT_FOUNDER_REPLY_TO,
            logContext: "Personal Welcome Email (Founder)",
        });
    }

    /**
     * Non-blocking asynchronous version for registration endpoints.
     */
    static sendPersonalWelcomeEmailAsync(options: SendPersonalWelcomeEmailOptions): void {
        setImmediate(async () => {
            try {
                await OnboardingEmailService.sendPersonalWelcomeEmail(options);
            } catch (err: any) {
                console.error(`[ONBOARDING EMAIL] ⚠️ Error sending welcome email to ${options.to}:`, err.message || err);
            }
        });
    }

    /**
     * 2. CLUB APPLICATION RECEIVED EMAIL (Sent to the Club Applicant)
     * Sent immediately when a student club submits a verification application.
     */
    static async sendClubApplicationReceivedEmail(options: SendClubApplicationReceivedEmailOptions): Promise<SendEmailResult> {
        const { to, contactPersonName, clubName, collegeName, clubCategory } = options;
        const recipientEmail = to.trim().toLowerCase();
        const firstName = contactPersonName.trim().split(" ")[0] || "Organizer";
        const dedupKey = `club:application_received:${recipientEmail}:${clubName.toLowerCase()}`;

        if (isDuplicateDispatch(dedupKey)) {
            console.log(`[ONBOARDING EMAIL] ⏭️ Skipped duplicate club application email to ${recipientEmail}`);
            return { success: true, simulated: true, messageId: "skipped_duplicate" };
        }

        const frontendUrl = getFrontendBaseUrl();
        const statusUrl = `${frontendUrl}/club/status`;
        const exploreUrl = `${frontendUrl}/explore`;

        const subject = `We received your club application for ${clubName}!`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Club Application Received — Orbix Campus</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 16px; box-shadow: 4px 4px 0px #000000; overflow: hidden; border-collapse: separate;" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #000000; padding: 18px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
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
                            ORBIX CAMPUS
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="background-color: #70D6FF; color: #000000; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; box-shadow: 1px 1px 0px #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                      Application Under Review
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 900; color: #000000; letter-spacing: -0.5px; line-height: 1.3;">
                Hey ${firstName},
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #222222; font-weight: 500;">
                Welcome to the Orbix Campus Ecosystem!
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
                I'm <strong>Vineet Chandel</strong>, the founder of Orbix, and I'm genuinely thrilled to see <strong>${clubName}</strong> taking the first step to join our verified campus network.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
                We started Orbix Campus with a dedicated collegiate vision: <strong>to empower student clubs, technical chapters, and campus organizations with the professional tools they need</strong>—from hosting verified hackathons and workshops to managing departments, delegating roles, and issuing cryptographically verifiable certificates.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                We have received your verification application for <strong>${clubName}</strong> at <strong>${collegeName}</strong>.
              </p>

              <!-- Verification Checklist / What Happens Next -->
              <div style="margin: 28px 0 24px 0; border-top: 2px dashed #000000; padding-top: 24px;">
                <h2 style="margin: 0 0 18px 0; font-size: 15px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">
                  Here is what happens next during the verification review:
                </h2>

                <!-- Point 1 -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 14px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    1. Review & Campus Affiliation Audit
                  </div>
                  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Our collegiate review team audits your application, checks leadership authorization, and coordinates with ${collegeName} to ensure authoritative student representation. This typically takes <strong>24 to 48 hours</strong>.
                  </p>
                </div>

                <!-- Point 2 -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 14px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    2. Track Your Application Live
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    You can inspect your 5-stage live verification timeline, verification checklist, and action items in real-time.
                  </p>
                  <a href="${statusUrl}" target="_blank" style="background-color: #FFE566; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Track Application Status
                  </a>
                </div>

                <!-- Point 3 -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 8px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 14px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    3. Prepare Your Chapter Presence
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    While our team reviews your application, gather your club logo, chapter description, social links, and core team member roster so you can launch immediately upon approval.
                  </p>
                  <a href="${exploreUrl}" target="_blank" style="background-color: #a2ff86; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Explore Campus Communities
                  </a>
                </div>
              </div>

              <!-- Question from Founder Box -->
              <div style="background-color: #FFF9E6; border: 2px solid #000000; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 3px 3px 0px #000000;">
                <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #855800; letter-spacing: 1px; margin-bottom: 8px;">
                  One thing I'd love to know...
                </div>
                <div style="font-size: 16px; font-weight: 900; color: #000000; margin-bottom: 8px;">
                  What is the biggest event or project ${clubName} is planning this semester?
                </div>
                <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.6; color: #333333;">
                  Are you hosting a hackathon, organizing technical workshops, launching a recruitment drive, or building an open-source cohort?
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #000000; font-weight: 700;">
                  Just hit <span style="background-color: #FFE566; padding: 2px 6px; border: 1px solid #000000; border-radius: 4px;">Reply</span> and tell me. I personally read every email and would love to support what your student community is building.
                </p>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Welcome aboard, and thank you for championing developer culture at ${collegeName}!
              </p>

              <!-- Founder Signature -->
              <div style="border-top: 2px solid #000000; padding-top: 18px; margin-top: 24px;">
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #444444; font-weight: 500;">Cheers,</p>
                <p style="margin: 0; font-size: 17px; font-weight: 900; color: #000000;">Vineet Chandel</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 700; color: #444444;">Founder, Orbix</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #666666; font-style: italic;">An Ecosystem for Developers</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF6EE; border-top: 2px solid #000000; padding: 18px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #777777;">
                Sent by <strong>Orbix Campus</strong> • Reply directly to this email to reach founder Vineet Chandel.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const text = `Hey ${firstName},

Welcome to the Orbix Campus Ecosystem!

I'm Vineet Chandel, the founder of Orbix, and I'm genuinely thrilled to see ${clubName} taking the first step to join our verified campus network.

We started Orbix Campus with a dedicated collegiate vision: to empower student clubs, technical chapters, and campus organizations with the professional tools they need—from hosting verified hackathons and workshops to managing departments, delegating roles, and issuing cryptographically verifiable certificates.

We have received your verification application for ${clubName} at ${collegeName}.

Here is what happens next during the verification review:

1. Review & Campus Affiliation Audit
Our collegiate review team audits your application, checks leadership authorization, and coordinates with ${collegeName} to ensure authoritative student representation. This typically takes 24 to 48 hours.

2. Track Your Application Live
You can check your real-time verification timeline, verification milestones, and action items at any time:
→ Track Application Status: ${statusUrl}

3. Prepare Your Chapter Presence
While our team reviews your application, gather your club logo, chapter description, social links, and core team member roster so you can launch immediately once approved.
→ Explore Campus Communities: ${exploreUrl}

One thing I'd love to know...

What is the biggest event or project ${clubName} is planning this semester?

Just hit Reply and tell me. I personally read every email and would love to support what your student community is building.

Welcome aboard, and thank you for championing developer culture at ${collegeName}!

Cheers,

Vineet Chandel
Founder, Orbix
An Ecosystem for Developers`;

        return dispatchEmail({
            to: recipientEmail,
            subject,
            html,
            text,
            customFrom: DEFAULT_FOUNDER_FROM,
            replyTo: DEFAULT_FOUNDER_REPLY_TO,
            logContext: "Club Application Received Email (Founder)",
        });
    }

    /**
     * Non-blocking asynchronous version for club registration.
     */
    static sendClubApplicationReceivedEmailAsync(options: SendClubApplicationReceivedEmailOptions): void {
        setImmediate(async () => {
            try {
                await OnboardingEmailService.sendClubApplicationReceivedEmail(options);
            } catch (err: any) {
                console.error(`[ONBOARDING EMAIL] ⚠️ Error sending club application email to ${options.to}:`, err.message || err);
            }
        });
    }

    /**
     * 3. CLUB APPLICATION ALERT (Sent to Orbix Team / Reviewers / Admin)
     * Alerts staff whenever a new collegiate club application is submitted.
     */
    static async sendClubApplicationStaffAlertEmail(options: SendClubApplicationStaffAlertEmailOptions): Promise<SendEmailResult> {
        const {
            clubName,
            clubCategory,
            collegeName,
            collegeCity,
            collegeState,
            contactPersonName,
            contactPersonRole,
            contactEmail,
            contactPhone,
            collegeOfficialEmail,
            clubWebsiteUrl,
            submittedAt,
            requestId,
        } = options;

        const staffEmail = getStaffNotificationEmail();

        const subject = `[New Club Application] ${clubName} — ${collegeName}`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Club Application Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 14px; box-shadow: 4px 4px 0px #000000;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background-color: #000000; padding: 16px 24px; color: #a2ff86; font-size: 16px; font-weight: 900; letter-spacing: 1px;">
              ORBIX STAFF ALERT • NEW CLUB REGISTRATION
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 900; color: #000000;">
                Collegiate Club Verification Request
              </h2>
              <table role="presentation" width="100%" style="border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; width: 140px; color: #555555;">Club Name:</td>
                  <td style="padding: 8px 0; font-weight: 700; color: #000000;">${clubName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Category:</td>
                  <td style="padding: 8px 0; color: #000000;">${clubCategory}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Institution:</td>
                  <td style="padding: 8px 0; color: #000000;">${collegeName} (${collegeCity || ""}, ${collegeState || ""})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Lead Representative:</td>
                  <td style="padding: 8px 0; color: #000000;"><strong>${contactPersonName}</strong> (${contactPersonRole})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Contact Email:</td>
                  <td style="padding: 8px 0; color: #000000;"><a href="mailto:${contactEmail}">${contactEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Contact Phone:</td>
                  <td style="padding: 8px 0; color: #000000;">${contactPhone || "Not provided"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">College Email:</td>
                  <td style="padding: 8px 0; color: #000000;">${collegeOfficialEmail || "Not provided"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Website / Social:</td>
                  <td style="padding: 8px 0; color: #000000;">${clubWebsiteUrl || "None"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Submitted At:</td>
                  <td style="padding: 8px 0; color: #000000;">${submittedAt ? new Date(submittedAt).toUTCString() : new Date().toUTCString()}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const text = `[ORBIX STAFF ALERT] New Club Verification Request

Club Name: ${clubName}
Category: ${clubCategory}
Institution: ${collegeName} (${collegeCity || ""}, ${collegeState || ""})
Lead Representative: ${contactPersonName} (${contactPersonRole})
Contact Email: ${contactEmail}
Contact Phone: ${contactPhone || "None"}
Official College Email: ${collegeOfficialEmail || "None"}
Website: ${clubWebsiteUrl || "None"}
Request ID: ${requestId}
Submitted: ${submittedAt ? new Date(submittedAt).toUTCString() : new Date().toUTCString()}`;

        return dispatchEmail({
            to: staffEmail,
            subject,
            html,
            text,
            customFrom: DEFAULT_SYSTEM_FROM,
            logContext: "Club Application Staff Alert",
        });
    }

    /**
     * Non-blocking asynchronous version for staff alert.
     */
    static sendClubApplicationStaffAlertEmailAsync(options: SendClubApplicationStaffAlertEmailOptions): void {
        setImmediate(async () => {
            try {
                await OnboardingEmailService.sendClubApplicationStaffAlertEmail(options);
            } catch (err: any) {
                console.error(`[ONBOARDING EMAIL] ⚠️ Error sending club staff alert:`, err.message || err);
            }
        });
    }

    /**
     * 4. CLUB VERIFIED & PROMOTED EMAIL (Sent to Club Representative)
     * Sent when a reviewer approves and officially activates the club.
     */
    static async sendClubVerifiedEmail(options: SendClubVerifiedEmailOptions): Promise<SendEmailResult> {
        const { to, contactPersonName, clubName, collegeName, slug } = options;
        const recipientEmail = to.trim().toLowerCase();
        const firstName = contactPersonName.trim().split(" ")[0] || "Organizer";
        const dedupKey = `club:verified:${recipientEmail}:${slug}`;

        if (isDuplicateDispatch(dedupKey)) {
            console.log(`[ONBOARDING EMAIL] ⏭️ Skipped duplicate club verified email to ${recipientEmail}`);
            return { success: true, simulated: true, messageId: "skipped_duplicate" };
        }

        const frontendUrl = getFrontendBaseUrl();
        const workspaceUrl = `${frontendUrl}/club/workspace`;
        const dashboardUrl = `${frontendUrl}/club/dashboard`;
        const publicClubUrl = `${frontendUrl}/clubs/${slug}`;

        const subject = `Congratulations! ${clubName} is now officially verified on Orbix!`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Club Verified on Orbix!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF6EE; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 16px; box-shadow: 4px 4px 0px #000000; overflow: hidden; border-collapse: separate;" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #000000; padding: 18px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
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
                            ORBIX CAMPUS
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="background-color: #a2ff86; color: #000000; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #000000; box-shadow: 1px 1px 0px #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                      Verified Chapter
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 900; color: #000000; letter-spacing: -0.5px; line-height: 1.3;">
                Hey ${firstName},
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #000000; font-weight: 900;">
                Huge congratulations! ${clubName} is now officially verified on Orbix!
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
                I'm <strong>Vineet Chandel</strong>, founder of Orbix. Our collegiate review team has verified your credentials and institutional affiliation with <strong>${collegeName}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Your official verified club profile and dedicated workspaces are now fully activated. We are thrilled to welcome your community to the platform.
              </p>

              <!-- Superpowers Unlocked Section -->
              <div style="margin: 28px 0 24px 0; border-top: 2px dashed #000000; padding-top: 24px;">
                <h2 style="margin: 0 0 18px 0; font-size: 15px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">
                  3 key superpowers unlocked for ${clubName}:
                </h2>

                <!-- Superpower 1 Card -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 15px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    1. Dedicated Club Dashboard & Team Workspace
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Organize your club into departments (Technical, Design, Operations), delegate manager permissions, create discussion channels, and track task accountability.
                  </p>
                  <a href="${workspaceUrl}" target="_blank" style="background-color: #a2ff86; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Open Team Workspace
                  </a>
                </div>

                <!-- Superpower 2 Card -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 15px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    2. Host Collegiate Events & Issue Verifiable Certificates
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Publish campus hackathons, workshops, and meetups. Collect attendee registrations and automatically issue tamper-proof digital certificates backed by SHA-256 cryptographic verification.
                  </p>
                  <a href="${dashboardUrl}" target="_blank" style="background-color: #FFE566; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; Manage Club Dashboard
                  </a>
                </div>

                <!-- Superpower 3 Card -->
                <div style="background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; padding: 18px 20px; margin-bottom: 8px; box-shadow: 2px 2px 0px #000000;">
                  <div style="font-size: 15px; font-weight: 900; color: #000000; margin-bottom: 6px;">
                    3. Your Public Campus Showcase
                  </div>
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #444444;">
                    Your official public chapter profile is live for all students to discover, follow, and join.
                  </p>
                  <a href="${publicClubUrl}" target="_blank" style="background-color: #70D6FF; color: #000000; text-decoration: none; font-size: 12px; font-weight: 900; padding: 7px 14px; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 1.5px 1.5px 0px #000000; display: inline-block;">
                    &rarr; View Public Club Page
                  </a>
                </div>
              </div>

              <!-- Founder Support Box -->
              <div style="background-color: #FFF9E6; border: 2px solid #000000; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 3px 3px 0px #000000;">
                <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #855800; letter-spacing: 1px; margin-bottom: 8px;">
                  Direct Founder Support
                </div>
                <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.6; color: #333333;">
                  If you or your core team ever need help configuring custom certificates, onboarding members, or organizing a campus hackathon, <strong>just hit Reply to reach me directly</strong>.
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #000000; font-weight: 700;">
                  Looking forward to seeing ${clubName} thrive on Orbix!
                </p>
              </div>

              <!-- Founder Signature -->
              <div style="border-top: 2px solid #000000; padding-top: 18px; margin-top: 24px;">
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #444444; font-weight: 500;">Cheers,</p>
                <p style="margin: 0; font-size: 17px; font-weight: 900; color: #000000;">Vineet Chandel</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 700; color: #444444;">Founder, Orbix</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #666666; font-style: italic;">An Ecosystem for Developers</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF6EE; border-top: 2px solid #000000; padding: 18px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #777777;">
                Sent by <strong>Orbix Campus</strong> • Reply directly to this email to reach founder Vineet Chandel.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const text = `Hey ${firstName},

Huge congratulations! ${clubName} is now officially verified on Orbix!

I'm Vineet Chandel, founder of Orbix. Our collegiate review team has verified your credentials and institutional affiliation with ${collegeName}.

Your verified club profile and dedicated workspaces are now fully activated.

3 key superpowers unlocked for ${clubName}:

1. Dedicated Club Dashboard & Team Workspace
Organize your club into departments, delegate manager permissions, create discussion channels, and track task accountability.
→ Open Team Workspace: ${workspaceUrl}

2. Host Collegiate Events & Issue Verifiable Certificates
Publish campus hackathons, workshops, and meetups. Collect attendee registrations and automatically issue tamper-proof digital certificates backed by SHA-256 cryptographic verification.
→ Manage Club Dashboard: ${dashboardUrl}

3. Your Public Campus Showcase
Your official public chapter profile is live for all students to discover, follow, and join.
→ View Public Club Page: ${publicClubUrl}

If you or your core team ever need help configuring custom certificates, onboarding members, or organizing a campus hackathon, just hit Reply to reach me directly.

Looking forward to seeing ${clubName} thrive on Orbix!

Cheers,

Vineet Chandel
Founder, Orbix
An Ecosystem for Developers`;

        return dispatchEmail({
            to: recipientEmail,
            subject,
            html,
            text,
            customFrom: DEFAULT_FOUNDER_FROM,
            replyTo: DEFAULT_FOUNDER_REPLY_TO,
            logContext: "Club Verified Email (Founder)",
        });
    }

    /**
     * Non-blocking asynchronous version for club verification.
     */
    static sendClubVerifiedEmailAsync(options: SendClubVerifiedEmailOptions): void {
        setImmediate(async () => {
            try {
                await OnboardingEmailService.sendClubVerifiedEmail(options);
            } catch (err: any) {
                console.error(`[ONBOARDING EMAIL] ⚠️ Error sending club verified email to ${options.to}:`, err.message || err);
            }
        });
    }

    /**
     * 5. CLUB VERIFIED STAFF ALERT (Sent to Orbix Team / Reviewers / Admin)
     * Alerts staff whenever a club is verified and promoted.
     */
    static async sendClubVerifiedStaffAlertEmail(options: SendClubVerifiedStaffAlertEmailOptions): Promise<SendEmailResult> {
        const { clubName, collegeName, slug, contactPersonName, contactEmail, reviewedBy, verifiedAt } = options;
        const staffEmail = getStaffNotificationEmail();
        const frontendUrl = getFrontendBaseUrl();
        const publicClubUrl = `${frontendUrl}/clubs/${slug}`;

        const subject = `[Club Verified & Activated] ${clubName} is now live!`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Club Verified Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #000000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 2px solid #000000; border-radius: 14px; box-shadow: 4px 4px 0px #000000;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background-color: #000000; padding: 16px 24px; color: #a2ff86; font-size: 16px; font-weight: 900; letter-spacing: 1px;">
              ORBIX STAFF ALERT • CLUB VERIFIED & ACTIVATED
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 900; color: #000000;">
                Club Promotion Confirmed
              </h2>
              <table role="presentation" width="100%" style="border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; width: 140px; color: #555555;">Club Name:</td>
                  <td style="padding: 8px 0; font-weight: 700; color: #000000;">${clubName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Public Slug:</td>
                  <td style="padding: 8px 0; color: #000000;">/clubs/${slug}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Institution:</td>
                  <td style="padding: 8px 0; color: #000000;">${collegeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Lead Representative:</td>
                  <td style="padding: 8px 0; color: #000000;"><strong>${contactPersonName}</strong> (<a href="mailto:${contactEmail}">${contactEmail}</a>)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Reviewed By:</td>
                  <td style="padding: 8px 0; color: #000000;">${reviewedBy || "Staff Reviewer"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 900; color: #555555;">Verified At:</td>
                  <td style="padding: 8px 0; color: #000000;">${verifiedAt ? new Date(verifiedAt).toUTCString() : new Date().toUTCString()}</td>
                </tr>
              </table>

              <div style="text-align: center; margin: 20px 0 10px 0;">
                <a href="${publicClubUrl}" target="_blank" style="background-color: #a2ff86; color: #000000; text-decoration: none; font-size: 13px; font-weight: 900; padding: 10px 20px; border: 2px solid #000000; border-radius: 8px; box-shadow: 2px 2px 0px #000000; display: inline-block;">
                  &rarr; View Live Club Public Page
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const text = `[ORBIX STAFF ALERT] Club Verified & Activated

Club Name: ${clubName}
Public Slug: /clubs/${slug}
Institution: ${collegeName}
Representative: ${contactPersonName} (${contactEmail})
Reviewed By: ${reviewedBy || "Staff Reviewer"}
Verified At: ${verifiedAt ? new Date(verifiedAt).toUTCString() : new Date().toUTCString()}

View Live Club Page: ${publicClubUrl}`;

        return dispatchEmail({
            to: staffEmail,
            subject,
            html,
            text,
            customFrom: DEFAULT_SYSTEM_FROM,
            logContext: "Club Verified Staff Alert",
        });
    }

    /**
     * Non-blocking asynchronous version for staff alert on verification.
     */
    static sendClubVerifiedStaffAlertEmailAsync(options: SendClubVerifiedStaffAlertEmailOptions): void {
        setImmediate(async () => {
            try {
                await OnboardingEmailService.sendClubVerifiedStaffAlertEmail(options);
            } catch (err: any) {
                console.error(`[ONBOARDING EMAIL] ⚠️ Error sending club verified staff alert:`, err.message || err);
            }
        });
    }
}
