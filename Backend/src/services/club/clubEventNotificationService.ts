import { query } from "../../database/client.js";

export type EventLifecycleAction = "published" | "cancelled" | "completed";

interface EventNotificationMetadata {
    eventId: string;
    clubId: string;
    clubSlug: string;
    action: EventLifecycleAction;
    eventTitle: string;
    clubName: string;
    collegeName: string;
    startsAt: string;
    venueOrLocation?: string | null;
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
    actorUserId?: string
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
            clubTitle = `⚠️ Session Cancelled: ${eventTitle}`;
            clubBody = `Event "${eventTitle}" has been marked as cancelled. Registered attendees and campus students have been notified.`;

            studentTitle = `❌ Event Cancelled: ${eventTitle}`;
            studentBody = `Important update: "${eventTitle}" by ${clubName} scheduled for ${formattedDate} has been cancelled.`;
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
                    OR u.id IN (SELECT user_id FROM club_event_registrations WHERE event_id = $5)
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
