import { dispatchEmail, DEFAULT_SYSTEM_FROM } from "./resendService";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Common Neo-brutalist Email Wrapper
 */
function buildNeoEmailWrapper({
    headline,
    badge,
    contentHtml,
    ctaText,
    ctaUrl,
}: {
    headline: string;
    badge: string;
    contentHtml: string;
    ctaText?: string;
    ctaUrl?: string;
}): { html: string; text: string } {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #FAF6EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #000000;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 3px solid #000000; border-radius: 16px; box-shadow: 6px 6px 0px #000000; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="padding: 24px; background-color: #FAF6EE; border-bottom: 3px solid #000000;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="display: inline-block; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #000000;">ORBIX</span>
              <span style="display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; background-color: #A6FF70; border: 1.5px solid #000000; padding: 2px 8px; border-radius: 6px;">Campus Events</span>
            </td>
            <td align="right">
              <span style="display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; background-color: #FFE566; border: 1.5px solid #000000; padding: 3px 8px; border-radius: 8px;">${badge}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 32px 28px;">
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 900; line-height: 1.3; color: #000000;">
          ${headline}
        </h1>

        <div style="font-size: 14px; line-height: 1.6; color: #222222;">
          ${contentHtml}
        </div>

        ${
            ctaText && ctaUrl
                ? `
        <div style="margin-top: 28px; text-align: left;">
          <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #A6FF70; color: #000000; text-decoration: none; font-weight: 900; font-size: 14px; border: 2px solid #000000; border-radius: 10px; box-shadow: 3px 3px 0px #000000;">
            ${ctaText} &rarr;
          </a>
        </div>
        `
                : ""
        }
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 28px; background-color: #FAF6EE; border-top: 2px solid #000000; font-size: 12px; font-weight: 700; color: #666666;">
        <p style="margin: 0;">Orbix · The Platform for Collegiate Developers & Clubs</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #888888;">If you didn't request this action, please contact support or ignore this email.</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const plainText = `${headline}\n\n${contentHtml.replace(/<[^>]+>/g, " ")}\n\n${ctaText ? `${ctaText}: ${ctaUrl}` : ""}\n\nOrbix Campus Events`;

    return { html, text: plainText };
}

/**
 * 1. Sole / Individual Registration Confirmation Email
 */
export async function sendSoleRegistrationEmail({
    to,
    recipientName,
    eventTitle,
    startsAt,
    venue,
    ticketCode,
    status,
}: {
    to: string;
    recipientName: string;
    eventTitle: string;
    startsAt: string;
    venue?: string;
    ticketCode?: string | null;
    status: string;
}) {
    const formattedDate = new Date(startsAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
    });

    const isConfirmed = status === "registered" || status === "attended";
    const badge = isConfirmed ? "Confirmed" : "Application Received";
    const headline = isConfirmed
        ? `Registration Confirmed for ${eventTitle}`
        : `Application Received for ${eventTitle}`;

    const contentHtml = `
    <p>Hey <strong>${recipientName}</strong>,</p>
    <p>${
        isConfirmed
            ? `You're all set! Your registration for <strong>${eventTitle}</strong> is confirmed.`
            : `Your application for <strong>${eventTitle}</strong> has been received and is currently under review by the event coordinators.`
    }</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; font-size: 13px;">
      <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${eventTitle}</p>
      <p style="margin: 0 0 8px 0;"><strong>Date & Time:</strong> ${formattedDate} (IST)</p>
      <p style="margin: 0 0 8px 0;"><strong>Venue / Location:</strong> ${venue || "Campus Venue / Online"}</p>
      ${
          ticketCode
              ? `<p style="margin: 0;"><strong>Ticket Code:</strong> <span style="font-family: monospace; font-weight: 900; background: #FFE566; padding: 2px 6px; border: 1px solid #000000; border-radius: 4px;">${ticketCode}</span></p>`
              : `<p style="margin: 0; color: #666666;"><em>Your admission pass will activate once the club approves your application.</em></p>`
      }
    </div>

    <p>You can track your application status, access session passes, and view event updates anytime from your Student Portfolio.</p>
  `;

    const { html, text } = buildNeoEmailWrapper({
        headline,
        badge,
        contentHtml,
        ctaText: "View Your Applications",
        ctaUrl: `${FRONTEND_URL}/events/tracker`,
    });

    return dispatchEmail({
        to,
        from: DEFAULT_SYSTEM_FROM,
        subject: `${isConfirmed ? "Registration Confirmed" : "Application Received"}: ${eventTitle}`,
        html,
        text,
        logContext: `[SoleRegistrationEmail: ${eventTitle}]`,
    });
}

/**
 * 2. Team Created Confirmation Email (Sent to Team Leader)
 */
export async function sendTeamCreatedEmail({
    to,
    leaderName,
    teamName,
    teamCode,
    eventTitle,
    startsAt,
    minTeamSize,
    maxTeamSize,
}: {
    to: string;
    leaderName: string;
    teamName: string;
    teamCode: string;
    eventTitle: string;
    startsAt: string;
    minTeamSize: number;
    maxTeamSize: number;
}) {
    const formattedDate = new Date(startsAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
    });

    const headline = `Team "${teamName}" Created for ${eventTitle}`;
    const badge = "Team Leader";

    const contentHtml = `
    <p>Hey <strong>${leaderName}</strong>,</p>
    <p>Awesome! You have successfully created team <strong>${teamName}</strong> for <strong>${eventTitle}</strong> as the <strong>Team Leader</strong>.</p>

    <div style="margin: 20px 0; padding: 18px; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; font-size: 13px;">
      <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Your Team Invite Code:</strong></p>
      <div style="font-family: monospace; font-size: 22px; font-weight: 900; background-color: #FFE566; color: #000000; padding: 10px 16px; border: 2px solid #000000; border-radius: 8px; display: inline-block; letter-spacing: 1px;">
        ${teamCode}
      </div>
      <p style="margin: 12px 0 6px 0;"><strong>Required Team Size:</strong> ${minTeamSize} to ${maxTeamSize} members</p>
      <p style="margin: 0;"><strong>Event Date:</strong> ${formattedDate} (IST)</p>
    </div>

    <h3 style="font-size: 14px; font-weight: 900; margin: 20px 0 8px 0;">How to Assemble Your Team:</h3>
    <ol style="margin: 0 0 16px 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
      <li><strong>Invite by Username:</strong> Search teammates by their Orbix username directly inside your Team Roster manager.</li>
      <li><strong>Share Your Team Code:</strong> Send code <code>${teamCode}</code> to your peers so they can join instantly.</li>
      <li><strong>Important Notice:</strong> All team joining, leaving, and roster changes must be completed <em>before</em> the event starts (${formattedDate}). Rosters lock automatically once the event begins.</li>
    </ol>
  `;

    const { html, text } = buildNeoEmailWrapper({
        headline,
        badge,
        contentHtml,
        ctaText: "Manage Team Roster & Invite",
        ctaUrl: `${FRONTEND_URL}/events/tracker`,
    });

    return dispatchEmail({
        to,
        from: DEFAULT_SYSTEM_FROM,
        subject: `Team Created: ${teamName} (${eventTitle})`,
        html,
        text,
        logContext: `[TeamCreatedEmail: ${teamName}]`,
    });
}

/**
 * 3. Team Member Invitation Email (Sent to Invitee)
 */
export async function sendTeamInvitationEmail({
    to,
    inviteeName,
    leaderName,
    leaderUsername,
    teamName,
    teamCode,
    eventTitle,
    startsAt,
}: {
    to: string;
    inviteeName: string;
    leaderName: string;
    leaderUsername: string;
    teamName: string;
    teamCode: string;
    eventTitle: string;
    startsAt: string;
}) {
    const formattedDate = new Date(startsAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
    });

    const headline = `Invitation to Join Team "${teamName}"`;
    const badge = "Team Invite";

    const contentHtml = `
    <p>Hey <strong>${inviteeName}</strong>,</p>
    <p><strong>${leaderName}</strong> (@${leaderUsername}) has invited you to join their team <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong> on Orbix.</p>

    <div style="margin: 20px 0; padding: 18px; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; font-size: 13px;">
      <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${eventTitle}</p>
      <p style="margin: 0 0 8px 0;"><strong>Team Name:</strong> ${teamName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Team Leader:</strong> ${leaderName} (@${leaderUsername})</p>
      <p style="margin: 0 0 8px 0;"><strong>Team Code:</strong> <span style="font-family: monospace; font-weight: 900; background: #FFE566; padding: 2px 6px; border: 1px solid #000000; border-radius: 4px;">${teamCode}</span></p>
      <p style="margin: 0;"><strong>Event Date:</strong> ${formattedDate} (IST)</p>
    </div>

    <p style="font-size: 13px; color: #555555;">
      You can accept or decline this invitation directly from your Orbix Applications dashboard. Note that team changes are only permitted before the event starts.
    </p>
  `;

    const { html, text } = buildNeoEmailWrapper({
        headline,
        badge,
        contentHtml,
        ctaText: "Review & Accept Invitation",
        ctaUrl: `${FRONTEND_URL}/events/tracker`,
    });

    return dispatchEmail({
        to,
        from: DEFAULT_SYSTEM_FROM,
        subject: `Team Invitation: ${leaderName} invited you to join ${teamName} (${eventTitle})`,
        html,
        text,
        logContext: `[TeamInvitationEmail: ${teamName} -> ${to}]`,
    });
}

/**
 * 4. Team Member Joined Notification Email
 * - Sent to Leader (notifying that a new member joined)
 * - Sent to Member (confirming they joined the team)
 */
export async function sendTeamMemberJoinedEmail({
    to,
    recipientName,
    memberName,
    memberUsername,
    memberEmail,
    teamName,
    eventTitle,
    isLeader,
    currentRosterCount,
    maxTeamSize,
}: {
    to: string;
    recipientName: string;
    memberName: string;
    memberUsername: string;
    memberEmail: string;
    teamName: string;
    eventTitle: string;
    isLeader: boolean;
    currentRosterCount: number;
    maxTeamSize: number;
}) {
    const headline = isLeader
        ? `${memberName} joined your team "${teamName}"`
        : `You have joined team "${teamName}"`;

    const badge = isLeader ? "Team Update" : "Joined Team";

    const contentHtml = isLeader
        ? `
    <p>Hey <strong>${recipientName}</strong>,</p>
    <p>Good news! <strong>${memberName}</strong> (@${memberUsername}) has accepted the invitation and joined your team <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; font-size: 13px;">
      <p style="margin: 0 0 6px 0;"><strong>New Teammate:</strong> ${memberName} (@${memberUsername})</p>
      <p style="margin: 0 0 6px 0;"><strong>Contact Email:</strong> ${memberEmail}</p>
      <p style="margin: 0 0 6px 0;"><strong>Public Profile:</strong> <a href="${FRONTEND_URL}/profile/${memberUsername}" style="color: #000000; font-weight: 800;">orbix.dev/profile/${memberUsername}</a></p>
      <p style="margin: 0;"><strong>Current Team Size:</strong> ${currentRosterCount} of ${maxTeamSize} members</p>
    </div>
    `
        : `
    <p>Hey <strong>${recipientName}</strong>,</p>
    <p>You have successfully joined team <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>!</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; font-size: 13px;">
      <p style="margin: 0 0 6px 0;"><strong>Team Name:</strong> ${teamName}</p>
      <p style="margin: 0 0 6px 0;"><strong>Event:</strong> ${eventTitle}</p>
      <p style="margin: 0;"><strong>Team Roster Status:</strong> ${currentRosterCount} of ${maxTeamSize} members enrolled</p>
    </div>

    <p style="font-size: 12px; color: #666666;">
      Remember: If you need to make changes or leave the team, it must be completed prior to the event start time.
    </p>
    `;

    const { html, text } = buildNeoEmailWrapper({
        headline,
        badge,
        contentHtml,
        ctaText: "View Team Roster",
        ctaUrl: `${FRONTEND_URL}/events/tracker`,
    });

    return dispatchEmail({
        to,
        from: DEFAULT_SYSTEM_FROM,
        subject: isLeader
            ? `New Teammate: ${memberName} joined ${teamName}`
            : `Joined Team: ${teamName} (${eventTitle})`,
        html,
        text,
        logContext: `[TeamMemberJoinedEmail: ${teamName}]`,
    });
}

/**
 * 5. Team Member Left or Removed Notification Email
 */
export async function sendTeamMemberLeftOrRemovedEmail({
    to,
    recipientName,
    memberName,
    teamName,
    eventTitle,
    action, // "left" | "removed"
    isLeaderNotification,
}: {
    to: string;
    recipientName: string;
    memberName: string;
    teamName: string;
    eventTitle: string;
    action: "left" | "removed";
    isLeaderNotification: boolean;
}) {
    const headline = isLeaderNotification
        ? `${memberName} has left team "${teamName}"`
        : `You were removed from team "${teamName}"`;

    const badge = "Roster Update";

    const contentHtml = isLeaderNotification
        ? `
    <p>Hey <strong>${recipientName}</strong>,</p>
    <p><strong>${memberName}</strong> has left team <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.</p>
    <p>You can invite another developer using your team code or search by username to fill the roster spot before the event starts.</p>
    `
        : `
    <p>Hey <strong>${recipientName}</strong>,</p>
    <p>You have been removed from team <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong> by the team leader.</p>
    <p>You are welcome to join another team with a team code, or create your own team for this event before registration closes.</p>
    `;

    const { html, text } = buildNeoEmailWrapper({
        headline,
        badge,
        contentHtml,
        ctaText: "View Event Details",
        ctaUrl: `${FRONTEND_URL}/events/tracker`,
    });

    return dispatchEmail({
        to,
        from: DEFAULT_SYSTEM_FROM,
        subject: `Roster Update: ${teamName} (${eventTitle})`,
        html,
        text,
        logContext: `[TeamRosterUpdate: ${teamName}]`,
    });
}

/**
 * 6. Team Registration Finalized / Confirmed Email
 */
export async function sendTeamRegistrationConfirmedEmail({
    to,
    memberName,
    teamName,
    eventTitle,
    startsAt,
    venue,
    ticketCode,
    isLeader,
}: {
    to: string;
    memberName: string;
    teamName: string;
    eventTitle: string;
    startsAt: string;
    venue?: string;
    ticketCode: string;
    isLeader: boolean;
}) {
    const formattedDate = new Date(startsAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
    });

    const headline = `Team Registration Confirmed: ${teamName}`;
    const badge = isLeader ? "Team Leader" : "Team Member";

    const contentHtml = `
    <p>Hey <strong>${memberName}</strong>,</p>
    <p>Great news! Team <strong>"${teamName}"</strong> has officially completed registration for <strong>${eventTitle}</strong>.</p>

    <div style="margin: 20px 0; padding: 18px; background-color: #FAF6EE; border: 2px solid #000000; border-radius: 12px; font-size: 13px;">
      <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${eventTitle}</p>
      <p style="margin: 0 0 8px 0;"><strong>Team Name:</strong> ${teamName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Date & Time:</strong> ${formattedDate} (IST)</p>
      <p style="margin: 0 0 8px 0;"><strong>Venue / Location:</strong> ${venue || "Campus Venue / Online"}</p>
      <p style="margin: 0;"><strong>Your Digital Admission Ticket:</strong> <span style="font-family: monospace; font-weight: 900; background: #A6FF70; padding: 3px 8px; border: 1.5px solid #000000; border-radius: 6px;">${ticketCode}</span></p>
    </div>

    <p>Make sure to have your admission pass ready when attending the event. Good luck to you and team ${teamName}!</p>
  `;

    const { html, text } = buildNeoEmailWrapper({
        headline,
        badge,
        contentHtml,
        ctaText: "Show Your Admission Pass",
        ctaUrl: `${FRONTEND_URL}/events/tracker?tab=sessions`,
    });

    return dispatchEmail({
        to,
        from: DEFAULT_SYSTEM_FROM,
        subject: `Registration Confirmed: ${teamName} (${eventTitle})`,
        html,
        text,
        logContext: `[TeamConfirmedEmail: ${teamName} -> ${to}]`,
    });
}
