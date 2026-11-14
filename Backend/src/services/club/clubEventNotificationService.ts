import { query } from "../../database/client.js";
import { sendEventCancellationEmail } from "../email/eventRegistrationEmailService.js";

export type EventLifecycleAction = "published" | "cancelled" | "completed";

export function getCancellationReasonDetails(reasonCat?: string): { label: string; description: string } {
    switch (reasonCat) {
        case "academic_institutional":
        case "academic_clash":
            return {
                label: "Academic / College Institutional Clash",
                description: "Mandatory campus exam, institutional holiday, or faculty directive.",
            };
        case "operational_delay":
            return {
                label: "Operational / Speaker / Venue Delay",
                description: "Venue unreadiness, speaker unavailability, or technical obstacles.",
            };
        case "low_registration":
        case "low_turnout":
            return {
                label: "Low Registration Turnout",
                description: "Insufficient student turnout to conduct the intended event program.",
            };
        case "emergency_verified":
            return {
                label: "Verified Emergency / Medical Incident",
                description: "Unexpected urgent emergency handled with responsible communication.",
            };
        case "weather_force_majeure":
            return {
                label: "Severe Weather / Force Majeure",
                description: "Unforeseen physical condition or natural hazard preventing safe assembly.",
            };
        case "unexplained":
        case "short_notice":
        default:
            return {
                label: "Unexplained / Short-Notice Discretionary",
                description: "Discretionary cancellation without documented external constraints.",
            };
    }
}

interface EventNotificationMetadata {
    eventId: string;
    clubId: string;
    clubSlug: string;
    action: EventLifecycleAction;
    eventTitle: string;
    clubName: string;
    collegeName: string;
    startsAt: string;
    venueOrLocation?: string | null | undefined;
    reasonCategory?: string | undefined;
    reasonLabel?: string | undefined;
    reasonDescription?: string | undefined;
}

/**
 * Dispatches notifications to the club (owner & active team coordinators)
 * and all students/users of that specific college campus whenever an event
 * is published, cancelled, or completed.
 */
export async function notifyClubAndCollegeUsers(
    eventId: string,
    clubId: string,
    action: EventLifecycleAction,
    actorUserId?: string,
    cancellationReasonCategory?: string
): Promise<{ success: boolean; clubNotified: number; collegeUsersNotified: number }> {
    try {
        // 1. Fetch event and club information
        const eventRes = await query(
            `SELECT
                e.id AS "eventId",
                e.title AS "eventTitle",
                e.starts_at AS "startsAt",
                e.venue_or_location AS "venueOrLocation",
                vc.id AS "clubId",
                vc.name AS "clubName",
                COALESCE(vc.slug, 'club') AS "clubSlug",
                vc.college_id AS "collegeId",
                vc.college_name AS "collegeName",
                vc.auth_user_id AS "clubOwnerId"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1 AND e.club_id = $2
             LIMIT 1;`,
            [eventId, clubId]
        );

        if (!eventRes.rows[0]) {
            console.warn(`[notifyClubAndCollegeUsers] Event ${eventId} not found for club ${clubId}`);
            return { success: false, clubNotified: 0, collegeUsersNotified: 0 };
        }

        const ev = eventRes.rows[0];
        const collegeName = ev.collegeName || "Your College Campus";
        const clubName = ev.clubName || "Verified Club";
        const eventTitle = ev.eventTitle || "Campus Event";
        const formattedDate = new Date(ev.startsAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        const reasonDetails = action === "cancelled" ? getCancellationReasonDetails(cancellationReasonCategory) : null;

        const metadata: EventNotificationMetadata = {
            eventId: ev.eventId,
            clubId: ev.clubId,
            clubSlug: ev.clubSlug,
            action,
            eventTitle,
            clubName,
            collegeName,
            startsAt: ev.startsAt,
            venueOrLocation: ev.venueOrLocation,
            ...(reasonDetails ? {
                reasonCategory: cancellationReasonCategory,
                reasonLabel: reasonDetails.label,
                reasonDescription: reasonDetails.description,
            } : {}),
        };
        const metadataJson = JSON.stringify(metadata);

        // 2. Determine Notification Copy
        let clubTitle = "";
        let clubBody = "";
        let studentTitle = "";
        let studentBody = "";

        if (action === "published") {
            clubTitle = `📢 Session Published: ${eventTitle}`;
            clubBody = `Your session "${eventTitle}" is now live and published to students at ${collegeName}.`;

            studentTitle = `🎉 New Campus Event: ${eventTitle}`;
            studentBody = `${clubName} just published a new event: "${eventTitle}" for ${formattedDate}. Tap to view agenda and RSVP!`;
        } else if (action === "cancelled") {
            const reasonSuffix = reasonDetails ? ` (${reasonDetails.label})` : "";
            clubTitle = `⚠️ Session Cancelled: ${eventTitle}`;
            clubBody = `Event "${eventTitle}" has been marked as cancelled${reasonSuffix}. Registered attendees and campus students have been notified.`;

            studentTitle = `❌ Event Cancelled: ${eventTitle}`;
            studentBody = `Important update: "${eventTitle}" by ${clubName} scheduled for ${formattedDate} has been cancelled.${reasonDetails ? ` Reason: ${reasonDetails.label}.` : ""}`;
        } else if (action === "completed") {
            clubTitle = `✅ Session Completed: ${eventTitle}`;
            clubBody = `Session "${eventTitle}" is marked as completed! You can review the attendee roster and turnout analytics in your club console.`;

            studentTitle = `🎓 Session Completed: ${eventTitle}`;
            studentBody = `"${eventTitle}" hosted by ${clubName} has concluded. Thank you for participating in campus activities!`;
        }

        const notifType = `event_${action}`;

        // 3. Dispatch to Club Staff (Owner + Active Team Members)
        const clubStaffRes = await query(
            `INSERT INTO user_notifications (
                user_id,
                recipient_id,
                username,
                title,
                body,
                type,
                notification_type,
                metadata,
                idempotency_key,
                is_read,
                created_at
            )
            SELECT
                u.id,
                u.id,
                u.username,
                $1,
                $2,
                'club_event',
                $3,
                $4::jsonb,
                CONCAT('club-event-', $5::text, '-', $6::text, '-', u.id::text),
                false,
                NOW()
            FROM users u
            WHERE u.id IN (
                SELECT auth_user_id FROM verified_clubs WHERE id = $7
                UNION
                SELECT user_id FROM club_team_members WHERE club_id = $7 AND status = 'active'
            )
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id;`,
            [clubTitle, clubBody, notifType, metadataJson, ev.eventId, action, ev.clubId]
        );
        const clubNotified = clubStaffRes.rowCount ?? 0;

        // 4. Dispatch to College Users and Registered Attendees
        let collegeUsersNotified = 0;

        // If published: notify all users affiliated with this college (excluding actor/club owner)
        // If cancelled or completed: notify all users affiliated with this college AND all users registered for this event
        if (action === "published") {
            const studentInsertRes = await query(
                `INSERT INTO user_notifications (
                    user_id,
                    recipient_id,
                    username,
                    title,
                    body,
                    type,
                    notification_type,
                    metadata,
                    idempotency_key,
                    is_read,
                    created_at
                )
                SELECT
                    u.id,
                    u.id,
                    u.username,
                    $1,
                    $2,
                    'club_event',
                    $3,
                    $4::jsonb,
                    CONCAT('student-event-', $5::text, '-', $6::text, '-', u.id::text),
                    false,
                    NOW()
                FROM users u
                WHERE (
                    ($7::uuid IS NOT NULL AND u.college_id = $7::uuid)
                    OR ($8::text IS NOT NULL AND LOWER(TRIM(COALESCE(u.college, ''))) = LOWER(TRIM($8::text)))
                )
                AND u.id NOT IN (
                    SELECT auth_user_id FROM verified_clubs WHERE id = $9
                    UNION
                    SELECT user_id FROM club_team_members WHERE club_id = $9 AND status = 'active'
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id;`,
                [
                    studentTitle,
                    studentBody,
                    notifType,
                    metadataJson,
                    ev.eventId,
                    action,
                    ev.collegeId,
                    ev.collegeName,
                    ev.clubId,
                ]
            );
            collegeUsersNotified = studentInsertRes.rowCount ?? 0;
        } else {
            // Cancelled or Completed: target both college members and registered attendees
            const studentInsertRes = await query(
                `INSERT INTO user_notifications (
                    user_id,
                    recipient_id,
                    username,
                    title,
                    body,
                    type,
                    notification_type,
                    metadata,
                    idempotency_key,
                    is_read,
                    created_at
                )
                SELECT
                    u.id,
                    u.id,
                    u.username,
                    $1,
                    $2,
                    'club_event',
                    $3,
                    $4::jsonb,
                    CONCAT('student-event-', $5::text, '-', $6::text, '-', u.id::text),
                    false,
                    NOW()
                FROM users u
                WHERE (
                    ($7::uuid IS NOT NULL AND u.college_id = $7::uuid)
                    OR ($8::text IS NOT NULL AND LOWER(TRIM(COALESCE(u.college, ''))) = LOWER(TRIM($8::text)))
                    OR u.id IN (SELECT user_id FROM club_event_registrations WHERE event_id = $5::uuid)
                )
                AND u.id NOT IN (
                    SELECT auth_user_id FROM verified_clubs WHERE id = $9
                    UNION
                    SELECT user_id FROM club_team_members WHERE club_id = $9 AND status = 'active'
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id;`,
                [
                    studentTitle,
                    studentBody,
                    notifType,
                    metadataJson,
                    ev.eventId,
                    action,
                    ev.collegeId,
                    ev.collegeName,
                    ev.clubId,
                ]
            );
            collegeUsersNotified = studentInsertRes.rowCount ?? 0;
        }

        console.log(
            `[notifyClubAndCollegeUsers] Dispatched "${action}" notifications for event "${eventTitle}": ` +
            `${clubNotified} club staff, ${collegeUsersNotified} college users/attendees.`
        );

        return { success: true, clubNotified, collegeUsersNotified };
    } catch (err) {
        console.error(`[notifyClubAndCollegeUsers] Error dispatching event notifications:`, err);
        return { success: false, clubNotified: 0, collegeUsersNotified: 0 };
    }
}

/**
 * Notifies ALL registered participants (whether status is pending, registered, attended,
 * rejected, waitlisted, or cancelled) when an event is cancelled by the club.
 * Sends both in-app notification and email with the specific cancellation reason.
 */
export async function notifyEventCancelledToAllApplicants({
    eventId,
    clubId,
    reasonCategory,
    actorUserId,
}: {
    eventId: string;
    clubId: string;
    reasonCategory?: string;
    actorUserId?: string;
}): Promise<{ totalApplicants: number; emailsSent: number; notificationsCreated: number }> {
    try {
        const eventRes = await query(
            `SELECT
                e.id AS "eventId",
                e.title AS "eventTitle",
                e.starts_at AS "startsAt",
                e.venue_or_location AS "venueOrLocation",
                vc.id AS "clubId",
                vc.name AS "clubName",
                COALESCE(vc.slug, 'club') AS "clubSlug",
                vc.college_name AS "collegeName",
                vc.college_id AS "collegeId"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1 AND e.club_id = $2
             LIMIT 1;`,
            [eventId, clubId]
        );

        if (!eventRes.rows[0]) {
            console.warn(`[notifyEventCancelledToAllApplicants] Event ${eventId} not found for club ${clubId}`);
            return { totalApplicants: 0, emailsSent: 0, notificationsCreated: 0 };
        }

        const ev = eventRes.rows[0];
        const eventTitle = ev.eventTitle || "Campus Event";
        const clubName = ev.clubName || "Host Club";
        const reasonDetails = getCancellationReasonDetails(reasonCategory);

        // Fetch ALL applicants who ever registered/applied for this event (regardless of status: accepted, rejected, pending, attended, etc.)
        const applicantsRes = await query(
            `SELECT DISTINCT
                r.id AS "registrationId",
                r.user_id AS "userId",
                r.status AS "status",
                COALESCE(NULLIF(TRIM(r.applicant_name), ''), NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, 'Student') AS "recipientName",
                COALESCE(NULLIF(TRIM(r.applicant_email), ''), u.email) AS "recipientEmail",
                u.username
             FROM club_event_registrations r
             JOIN users u ON u.id = r.user_id
             WHERE r.event_id = $1::uuid;`,
            [eventId]
        );

        const applicants = applicantsRes.rows || [];
        const totalApplicants = applicants.length;

        const formattedDate = new Date(ev.startsAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        const notifTitle = `❌ Event Cancelled: ${eventTitle}`;
        const notifBody = `Important update: "${eventTitle}" by ${clubName} (${formattedDate}) has been cancelled. Reason: ${reasonDetails.label}.`;
        const metadata: EventNotificationMetadata = {
            eventId: ev.eventId,
            clubId: ev.clubId,
            clubSlug: ev.clubSlug,
            action: "cancelled",
            eventTitle,
            clubName,
            collegeName: ev.collegeName || "Your College Campus",
            startsAt: ev.startsAt,
            venueOrLocation: ev.venueOrLocation,
            reasonCategory,
            reasonLabel: reasonDetails.label,
            reasonDescription: reasonDetails.description,
        };
        const metadataJson = JSON.stringify(metadata);

        // 1. In-app notifications to all registered applicants
        let notificationsCreated = 0;
        if (totalApplicants > 0) {
            const notifInsert = await query(
                `INSERT INTO user_notifications (
                    user_id,
                    recipient_id,
                    username,
                    title,
                    body,
                    type,
                    notification_type,
                    metadata,
                    idempotency_key,
                    is_read,
                    created_at
                )
                SELECT
                    u.id,
                    u.id,
                    u.username,
                    $1,
                    $2,
                    'club_event',
                    'event_cancelled',
                    $3::jsonb,
                    CONCAT('cancel-app-', $4::text, '-', u.id::text, '-', EXTRACT(EPOCH FROM NOW())::int),
                    false,
                    NOW()
                FROM users u
                WHERE u.id IN (
                    SELECT DISTINCT user_id FROM club_event_registrations WHERE event_id = $4::uuid
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id;`,
                [notifTitle, notifBody, metadataJson, ev.eventId]
            );
            notificationsCreated = notifInsert.rowCount ?? 0;
        }

        // 2. Transactional Outbox Pattern: Create durable notification campaign
        const campaignPayload = {
            eventTitle,
            clubName,
            startsAt: ev.startsAt,
            venue: ev.venueOrLocation,
            reasonLabel: reasonDetails.label,
            reasonDescription: reasonDetails.description,
            subject: `[Cancelled] ${eventTitle} · ${clubName}`,
        };

        const campaignIdempotencyKey = `cancel-campaign-${eventId}`;
        const campaignRes = await query(
            `INSERT INTO public.email_outbox_campaigns (
                event_id,
                club_id,
                campaign_type,
                title,
                status,
                total_recipients,
                payload,
                idempotency_key,
                created_at,
                updated_at
            ) VALUES (
                $1::uuid,
                $2::uuid,
                'event_cancellation',
                $3,
                'PENDING',
                $4,
                $5::jsonb,
                $6,
                now(),
                now()
            )
            ON CONFLICT (idempotency_key) DO UPDATE
            SET updated_at = now()
            RETURNING id;`,
            [
                eventId,
                clubId,
                `Cancellation Notice: ${eventTitle}`,
                totalApplicants,
                JSON.stringify(campaignPayload),
                campaignIdempotencyKey,
            ]
        );

        const campaignId = campaignRes.rows[0]?.id;
        if (campaignId) {
            try {
                const { EmailQueueService } = await import("../email/emailQueueService.js");
                const enqueued = await EmailQueueService.enqueueCampaignFanout({
                    campaignId,
                    eventId,
                    clubId,
                    campaignType: "event_cancellation",
                });

                if (!enqueued) {
                    // Fallback to inline fan-out if queue/Redis unavailable
                    const { processCampaignFanout } = await import("../../workers/emailCampaignFanoutWorker.js");
                    await processCampaignFanout(campaignId);
                }
            } catch (fanoutErr: any) {
                console.error(`[notifyEventCancelledToAllApplicants] Fan-out dispatch error:`, fanoutErr.message);
            }
        }

        // 3. Also notify club team members & college broadcast with reason
        await notifyClubAndCollegeUsers(eventId, clubId, "cancelled", actorUserId, reasonCategory);

        console.log(
            `[notifyEventCancelledToAllApplicants] Event "${eventTitle}" cancelled: campaign created for ${totalApplicants} applicants (${notificationsCreated} in-app alerts). Reason: "${reasonDetails.label}"`
        );

        return { totalApplicants, emailsSent: totalApplicants, notificationsCreated };
    } catch (err) {
        console.error(`[notifyEventCancelledToAllApplicants] Error:`, err);
        return { totalApplicants: 0, emailsSent: 0, notificationsCreated: 0 };
    }
}
