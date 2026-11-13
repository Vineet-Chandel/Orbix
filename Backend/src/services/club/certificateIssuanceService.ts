/**
 * Certificate Studio Batch Issuance & Eligibility Engine
 * Phase 10, 11, 12, 14, 15 Implementation
 */
import crypto from "crypto";
import { query, pool } from "../../database/client.js";
import { CertificatePdfService } from "./certificatePdfService.js";
import { CertificateTemplateService } from "./certificateTemplateService.js";
import { ClubCredibilityService } from "./clubCredibilityService.js";
import { CertificateQueueService } from "./certificateQueueService.js";
import { CertificateNotificationService, type UserAwardsEntry } from "./certificateNotificationService.js";
import type { CertificateDesign, DynamicDataSnapshot } from "../../types/certificateStudio.js";

export const MAX_RECIPIENTS_PER_BATCH = 5000;

export interface BatchIssuanceRequest {
    clubId: string;
    staffUserId: string;
    templateId?: string | null;
    customDesign?: CertificateDesign | null;
    title: string;
    certificateType:
        | "participation"
        | "attendance"
        | "completion"
        | "winner"
        | "first_runner_up"
        | "second_runner_up"
        | "finalist"
        | "best_innovation"
        | "best_project"
        | "best_performer"
        | "speaker"
        | "mentor"
        | "judge"
        | "volunteer"
        | "organizer"
        | "excellence"
        | "merit"
        | "contributor"
        | "appreciation"
        | string;
    issuanceSource: "event" | "team" | "manual" | "csv";
    eventId?: string | null;
    teamId?: string | null;
    awardPosition?: string;
    description?: string;
    signerName?: string;
    signerRole?: string;
    issueDate?: string;
    metadata?: Record<string, any>;
    teamIssuanceMode?: "individual_only" | "team_only" | "both";
    teamSnapshots?: Array<{
        teamId: string;
        teamName: string;
        members: Array<{
            userId?: string;
            isExternal?: boolean;
            name: string;
            username?: string;
            email?: string;
            role?: string;
            customPosition?: string;
        }>;
    }>;
    recipients: Array<{
        userId?: string;
        email?: string;
        name?: string;
        customName?: string;
        customRole?: string;
        customPosition?: string;
        isExternal?: boolean;
        teamId?: string;
        teamName?: string;
    }>;
    allowManualOverride?: boolean;
    overrideReason?: string;
    asyncMode?: boolean;
    idempotencyKey?: string;
}

export interface RecipientDirectoryItem {
    id: string;
    name: string;
    username: string;
    email?: string;
    isEmailMasked: boolean;
    avatarUrl?: string | null;
    collegeId?: string | null;
    collegeName?: string | null;
    department?: string | null;
    sourceCategory: "club_member" | "team_member" | "event_participant" | "orbix_user";
    roleBadge: string;
    eventsAttendedCount?: number;
    eventsRegisteredCount?: number;
    teamRole?: string | null;
    teamName?: string | null;
    teamId?: string | null;
}

export interface ClubTeamDirectoryItem {
    teamId: string;
    teamName: string;
    description?: string | null;
    memberCount: number;
    members: Array<{
        userId: string;
        name: string;
        username: string;
        role: string;
    }>;
}

export function maskEmail(email: string | null | undefined): string {
    if (!email || typeof email !== "string" || !email.includes("@")) return "***";
    const parts = email.split("@");
    const local = parts[0] || "";
    const domain = parts[1] || "";
    if (!domain || !local) return "***";
    if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
    }
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export interface EventEligibilityReport {
    eventId: string;
    eventTitle: string;
    eventStartsAt: string | null;
    category: string;
    summary: {
        totalRegistrations: number;
        eligibleCount: number;
        verifiedAttendeesCount: number;
        ineligibleCount: number;
        manualReviewCount: number;
        missingInfoCount: number;
        teamEligibilityCount: number;
        alreadyIssuedCount: number;
    };
    eligibleRecipients: Array<{
        userId: string;
        registrationId: string;
        name: string;
        email: string;
        username: string;
        collegeName: string;
        status: string;
        checkedInAt: string | null;
        ticketCode: string;
        department?: string;
        yearOfStudy?: string;
        teamId?: string;
        teamName?: string;
        quizScore?: number;
        awardPosition?: string;
        alreadyHasCert: boolean;
    }>;
    ineligibleRecipients: Array<{
        userId: string;
        registrationId: string;
        name: string;
        email: string;
        username: string;
        status: string;
        checkedInAt: string | null;
        exclusionReason: string;
    }>;
    manualReviewCases: Array<{
        userId: string;
        name: string;
        email: string;
        issue: string;
        suggestedAction: string;
    }>;
}

export interface BatchIssuanceResponse {
    batchId: string;
    totalRequested: number;
    successfulCount: number;
    deduplicatedCount: number;
    teamCertificatesCount: number;
    individualCertificatesCount: number;
    skippedCount: number;
    failedCount: number;
    isAsync?: boolean;
    status?: "queued" | "processing" | "completed" | "partially_failed" | "failed";
    issuedCertificates: Array<{
        id: string;
        recipientId: string;
        recipientName: string;
        credentialCode: string;
        isTeam?: boolean;
        teamId?: string;
        sha256Hash?: string;
        claimToken?: string;
    }>;
    message: string;
}

export class CertificateIssuanceService {
    /**
     * Searches authorized recipient sources with strict privacy protection (Phase 11)
     * - Does NOT disclose private phone numbers.
     * - Masks emails for global user search.
     * - Supports club members, team members, past event attendees, global users, and full teams.
     */
    static async searchRecipientDirectory(
        clubId: string,
        source: "all" | "orbix_user" | "username" | "club_members" | "event_participants" | "team_members" | "teams" = "all",
        searchQuery = ""
    ): Promise<{
        recipients: RecipientDirectoryItem[];
        teams?: ClubTeamDirectoryItem[];
    }> {
        const cleanQuery = searchQuery.trim().replace(/^@/, "");

        if (source === "teams") {
            const teamsRes = await query(
                `SELECT
                    ct.id AS "teamId",
                    ct.name AS "teamName",
                    ct.description,
                    COUNT(ctm.id)::int AS "memberCount",
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'userId', u.id,
                                'name', COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username),
                                'username', u.username,
                                'role', COALESCE(ctm.team_title, ctm.team_role, ctm.position_title, 'Member')
                            )
                        ) FILTER (WHERE u.id IS NOT NULL),
                        '[]'::json
                    ) AS members
                 FROM club_teams ct
                 LEFT JOIN club_team_members ctm ON ctm.team_id = ct.id AND ctm.status = 'active'
                 LEFT JOIN users u ON u.id = ctm.user_id
                 WHERE ct.club_id = $1
                   AND ($2 = '' OR ct.name ILIKE '%' || $2 || '%')
                 GROUP BY ct.id, ct.name, ct.description
                 ORDER BY ct.name ASC;`,
                [clubId, cleanQuery]
            );

            return {
                recipients: [],
                teams: teamsRes.rows,
            };
        }

        const recipients: RecipientDirectoryItem[] = [];

        // 1. Club Members
        if (source === "all" || source === "club_members") {
            const memRes = await query(
                `SELECT DISTINCT
                    u.id,
                    COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                    u.username,
                    u.email,
                    COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                    u.college_id AS "collegeId",
                    COALESCE(inst.official_name, u.college) AS "collegeName",
                    COALESCE(cm.club_role, cm.access_role, 'Member') AS "roleBadge",
                    'club_member' AS "sourceCategory"
                 FROM club_memberships cm
                 JOIN users u ON u.id = cm.user_id
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE cm.club_id = $1 AND cm.status = 'active'
                   AND (
                     $2 = ''
                     OR u.username ILIKE '%' || $2 || '%'
                     OR u.firstname ILIKE '%' || $2 || '%'
                     OR u.lastname ILIKE '%' || $2 || '%'
                     OR u.email ILIKE '%' || $2 || '%'
                   )
                 ORDER BY name ASC
                 LIMIT 100;`,
                [clubId, cleanQuery]
            );

            for (const r of memRes.rows) {
                recipients.push({
                    id: r.id,
                    name: r.name,
                    username: r.username,
                    email: r.email,
                    isEmailMasked: false,
                    avatarUrl: r.avatarUrl,
                    collegeId: r.collegeId,
                    collegeName: r.collegeName,
                    sourceCategory: "club_member",
                    roleBadge: `Club Member (${r.roleBadge})`,
                });
            }
        }

        // 2. Team Members
        if (source === "all" || source === "team_members") {
            const teamRes = await query(
                `SELECT DISTINCT
                    u.id,
                    COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                    u.username,
                    u.email,
                    COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                    u.college_id AS "collegeId",
                    COALESCE(inst.official_name, u.college) AS "collegeName",
                    ct.id AS "teamId",
                    ct.name AS "teamName",
                    COALESCE(ctm.team_title, ctm.team_role, ctm.position_title, 'Member') AS "teamRole",
                    'team_member' AS "sourceCategory"
                 FROM club_team_members ctm
                 JOIN club_teams ct ON ct.id = ctm.team_id
                 JOIN users u ON u.id = ctm.user_id
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE ctm.club_id = $1 AND ctm.status = 'active'
                   AND (
                     $2 = ''
                     OR u.username ILIKE '%' || $2 || '%'
                     OR u.firstname ILIKE '%' || $2 || '%'
                     OR u.lastname ILIKE '%' || $2 || '%'
                     OR ct.name ILIKE '%' || $2 || '%'
                   )
                 ORDER BY name ASC
                 LIMIT 100;`,
                [clubId, cleanQuery]
            );

            for (const r of teamRes.rows) {
                if (!recipients.some((existing) => existing.id === r.id)) {
                    recipients.push({
                        id: r.id,
                        name: r.name,
                        username: r.username,
                        email: r.email,
                        isEmailMasked: false,
                        avatarUrl: r.avatarUrl,
                        collegeId: r.collegeId,
                        collegeName: r.collegeName,
                        teamId: r.teamId,
                        teamName: r.teamName,
                        teamRole: r.teamRole,
                        sourceCategory: "team_member",
                        roleBadge: `Team (${r.teamName} · ${r.teamRole || "Member"})`,
                    });
                }
            }
        }

        // 3. Past Event Participants
        if (source === "all" || source === "event_participants") {
            const eventRes = await query(
                `SELECT DISTINCT
                    u.id,
                    COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                    u.username,
                    u.email,
                    COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                    u.college_id AS "collegeId",
                    COALESCE(inst.official_name, u.college) AS "collegeName",
                    CASE WHEN reg.status = 'attended' THEN 'Verified Event Attendee' ELSE 'Registered Participant' END AS "roleBadge",
                    'event_participant' AS "sourceCategory"
                 FROM club_event_registrations reg
                 JOIN users u ON u.id = reg.user_id
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE reg.club_id = $1
                   AND (
                     $2 = ''
                     OR u.username ILIKE '%' || $2 || '%'
                     OR u.firstname ILIKE '%' || $2 || '%'
                     OR u.lastname ILIKE '%' || $2 || '%'
                     OR u.email ILIKE '%' || $2 || '%'
                   )
                 ORDER BY name ASC
                 LIMIT 100;`,
                [clubId, cleanQuery]
            );

            for (const r of eventRes.rows) {
                if (!recipients.some((existing) => existing.id === r.id)) {
                    recipients.push({
                        id: r.id,
                        name: r.name,
                        username: r.username,
                        email: r.email,
                        isEmailMasked: false,
                        avatarUrl: r.avatarUrl,
                        collegeId: r.collegeId,
                        collegeName: r.collegeName,
                        sourceCategory: "event_participant",
                        roleBadge: r.roleBadge,
                    });
                }
            }
        }

        // 4. Global Orbix User Search / Username Search
        // Strictly masks email and NEVER discloses phone numbers!
        if (source === "orbix_user" || source === "username" || (source === "all" && cleanQuery.length >= 2 && recipients.length < 15)) {
            const userRes = await query(
                `SELECT DISTINCT
                    u.id,
                    COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                    u.username,
                    u.email,
                    COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                    u.college_id AS "collegeId",
                    COALESCE(inst.official_name, u.college) AS "collegeName",
                    'orbix_user' AS "sourceCategory"
                 FROM users u
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE (
                    u.username ILIKE '%' || $1 || '%'
                    OR u.firstname ILIKE '%' || $1 || '%'
                    OR u.lastname ILIKE '%' || $1 || '%'
                 )
                 ORDER BY u.username ASC
                 LIMIT 50;`,
                [cleanQuery]
            );

            for (const r of userRes.rows) {
                if (!recipients.some((existing) => existing.id === r.id)) {
                    recipients.push({
                        id: r.id,
                        name: r.name,
                        username: r.username,
                        email: maskEmail(r.email),
                        isEmailMasked: true,
                        avatarUrl: r.avatarUrl,
                        collegeId: r.collegeId,
                        collegeName: r.collegeName,
                        sourceCategory: "orbix_user",
                        roleBadge: "Orbix Platform User",
                    });
                }
            }
        }

        return { recipients };
    }

    /**
     * Retrieves team details and active membership roster for pre-issuance review (Phase 12)
     */
    static async getTeamRosterForReview(clubId: string, teamId: string, eventId?: string) {
        const teamRes = await query(
            `SELECT id, name, slug, description, created_at AS "createdAt"
             FROM club_teams
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [teamId, clubId]
        );
        const team = teamRes.rows[0];
        if (!team) throw new Error("Team not found or does not belong to your club.");

        const membersRes = await query(
            `SELECT
                u.id AS "userId",
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                u.username,
                u.email,
                COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                COALESCE(inst.official_name, u.college) AS "collegeName",
                COALESCE(ctm.team_title, ctm.team_role, ctm.position_title, 'Member') AS role,
                ctm.status,
                ctm.assigned_at AS "assignedAt",
                EXISTS (
                    SELECT 1 FROM club_certificates cc
                    WHERE cc.club_id = $2
                      AND cc.user_id = u.id
                      AND cc.team_id = $1
                      AND ($3::uuid IS NULL OR cc.event_id = $3)
                ) AS "alreadyHasCert"
             FROM club_team_members ctm
             JOIN users u ON u.id = ctm.user_id
             LEFT JOIN institutions inst ON inst.id = u.college_id
             WHERE ctm.team_id = $1 AND ctm.club_id = $2 AND ctm.status = 'active'
             ORDER BY ctm.assigned_at ASC, name ASC;`,
            [teamId, clubId, eventId || null]
        );

        return {
            teamId: team.id,
            teamName: team.name,
            teamSlug: team.slug,
            description: team.description,
            createdAt: team.createdAt,
            memberCount: membersRes.rows.length,
            members: membersRes.rows.map((m) => ({
                userId: m.userId,
                name: m.name,
                username: m.username,
                email: m.email,
                emailMasked: maskEmail(m.email),
                avatarUrl: m.avatarUrl,
                collegeName: m.collegeName,
                role: m.role,
                status: m.status,
                assignedAt: m.assignedAt,
                alreadyHasCert: m.alreadyHasCert,
            })),
        };
    }

    /**
     * Verifies that a staff user has authorization (owner, admin, lead, coordinator) for a club
     */
    static async verifyClubRole(userId: string, clubId: string): Promise<boolean> {
        const res = await query(
            `SELECT vc.id
             FROM verified_clubs vc
             LEFT JOIN club_memberships cm ON cm.club_id = vc.id AND cm.user_id = $1 AND cm.status = 'active'
             WHERE (vc.auth_user_id = $1 OR cm.access_role IN ('owner', 'admin', 'team_lead', 'advisor', 'coordinator', 'lead'))
               AND vc.id = $2
             LIMIT 1;`,
            [userId, clubId]
        );
        return Boolean(res.rows[0]);
    }

    /**
     * Evaluates comprehensive participant eligibility for an event according to category rules (Phase 10)
     */
    static async evaluateEventEligibility(
        clubId: string,
        eventId: string,
        category: string = "participation",
        _teamId?: string
    ): Promise<EventEligibilityReport> {
        // 1. Verify event ownership
        const evRes = await query(
            `SELECT id, title, starts_at, venue_or_location FROM club_events WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [eventId, clubId]
        );
        const event = evRes.rows[0];
        if (!event) throw new Error("Event not found or does not belong to your club.");

        // 2. Fetch all registered users for this event
        const regRes = await query(
            `SELECT
                r.id AS "registrationId",
                r.user_id AS "userId",
                r.status AS "status",
                r.registered_at AS "registeredAt",
                r.checked_in_at AS "checkedInAt",
                r.ticket_code AS "ticketCode",
                r.applicant_name AS "applicantName",
                r.applicant_email AS "applicantEmail",
                r.department,
                r.year_of_study AS "yearOfStudy",
                r.quiz_score AS "quizScore",
                u.username,
                u.email AS "userEmail",
                COALESCE(r.applicant_name, TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                COALESCE(r.applicant_email, u.email) AS email,
                COALESCE(inst.official_name, u.college) AS "collegeName",
                EXISTS (
                    SELECT 1 FROM club_certificates cc
                    WHERE cc.club_id = $1
                      AND cc.event_id = $2
                      AND cc.user_id = r.user_id
                      AND cc.certificate_type = $3
                ) AS "alreadyHasCert",
                ctm.team_id AS "teamId",
                ct.name AS "teamName"
            FROM club_event_registrations r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN institutions inst ON u.college_id = inst.id
            LEFT JOIN club_team_members ctm ON ctm.user_id = u.id AND ctm.club_id = $1
            LEFT JOIN club_teams ct ON ct.id = ctm.team_id
            WHERE r.event_id = $2 AND r.club_id = $1
            ORDER BY r.registered_at ASC;`,
            [clubId, eventId, category]
        );

        const rows = regRes.rows;
        const eligibleRecipients: any[] = [];
        const ineligibleRecipients: any[] = [];
        const manualReviewCases: any[] = [];

        let verifiedAttendeesCount = 0;
        let missingInfoCount = 0;
        let alreadyIssuedCount = 0;
        let teamEligibilityCount = 0;

        for (const r of rows) {
            const isAttended = r.status === "attended" && r.checkedInAt != null;
            if (isAttended) verifiedAttendeesCount++;
            if (r.alreadyHasCert) alreadyIssuedCount++;
            if (r.teamId || r.teamName) teamEligibilityCount++;

            const hasMissingInfo = !r.name || r.name === r.username || !r.email;
            if (hasMissingInfo) {
                missingInfoCount++;
                manualReviewCases.push({
                    userId: r.userId,
                    name: r.name,
                    email: r.email,
                    issue: "Missing verified full name or institutional profile",
                    suggestedAction: "Manually specify student's full name in custom recipient fields before issuance.",
                });
            }

            // Eligibility Evaluation based on award category rules (Phase 10)
            let isEligible = false;
            let exclusionReason = "";

            if (r.status === "cancelled") {
                isEligible = false;
                exclusionReason = "Event RSVP registration was cancelled.";
            } else if (r.status === "blocked") {
                isEligible = false;
                exclusionReason = "User has been blocked by club moderation.";
            } else if (r.status === "waitlisted") {
                isEligible = false;
                exclusionReason = "Student was waitlisted and did not receive a confirmed event ticket.";
            } else if (category === "attendance") {
                // Strict attendance rule: registration alone is never interpreted as verified attendance!
                if (isAttended) {
                    isEligible = true;
                } else {
                    isEligible = false;
                    exclusionReason = "No verified attendance check-in. Registration alone is not proof of attendance.";
                }
            } else if (category === "participation") {
                // Participation: Valid registration status ('registered' | 'attended')
                isEligible = r.status === "registered" || r.status === "attended";
                if (!isEligible) {
                    exclusionReason = `Status "${r.status}" is not eligible for participation credentials.`;
                }
            } else if (category === "completion") {
                // Completion: Must be attended or passed quiz
                if (isAttended || (r.quizScore != null && r.quizScore >= 50)) {
                    isEligible = true;
                } else {
                    isEligible = false;
                    exclusionReason = "Event completion requirements (attendance or passing quiz score) not fulfilled.";
                }
            } else if (
                [
                    "winner",
                    "first_runner_up",
                    "second_runner_up",
                    "finalist",
                    "best_innovation",
                    "best_project",
                    "best_performer",
                ].includes(category)
            ) {
                // Achievement / Winner: Must be verified attendee
                if (isAttended) {
                    isEligible = true;
                } else {
                    isEligible = false;
                    exclusionReason = "Only verified event attendees are eligible for winner and achievement awards.";
                }
            } else {
                // General / Recognition / Contributor / Speaker / Mentor / Judge / Organizer
                isEligible = true;
            }

            if (isEligible) {
                eligibleRecipients.push({
                    userId: r.userId,
                    registrationId: r.registrationId,
                    name: r.name,
                    email: r.email,
                    username: r.username,
                    collegeName: r.collegeName,
                    status: r.status,
                    checkedInAt: r.checkedInAt,
                    ticketCode: r.ticketCode,
                    department: r.department,
                    yearOfStudy: r.yearOfStudy,
                    teamId: r.teamId,
                    teamName: r.teamName,
                    quizScore: r.quizScore,
                    alreadyHasCert: r.alreadyHasCert,
                });
            } else {
                ineligibleRecipients.push({
                    userId: r.userId,
                    registrationId: r.registrationId,
                    name: r.name,
                    email: r.email,
                    username: r.username,
                    status: r.status,
                    checkedInAt: r.checkedInAt,
                    exclusionReason,
                });
            }
        }

        return {
            eventId: event.id,
            eventTitle: event.title,
            eventStartsAt: event.starts_at ? new Date(event.starts_at).toISOString() : null,
            category,
            summary: {
                totalRegistrations: rows.length,
                eligibleCount: eligibleRecipients.length,
                verifiedAttendeesCount,
                ineligibleCount: ineligibleRecipients.length,
                manualReviewCount: manualReviewCases.length,
                missingInfoCount,
                teamEligibilityCount,
                alreadyIssuedCount,
            },
            eligibleRecipients,
            ineligibleRecipients,
            manualReviewCases,
        };
    }

    /**
     * Issues certificates in batch with strict eligibility, snapshot immutability, and transactional persistence
     */
    static async issueBatch(req: BatchIssuanceRequest): Promise<BatchIssuanceResponse> {
        const {
            clubId,
            staffUserId,
            templateId,
            customDesign,
            title,
            certificateType = "participation",
            issuanceSource = "event",
            eventId,
            teamId,
            awardPosition,
            description,
            signerName,
            signerRole,
            issueDate,
            metadata,
            teamIssuanceMode = "individual_only",
            teamSnapshots = [],
            recipients = [],
            allowManualOverride,
            overrideReason,
        } = req;

        const cleanTitle = title.trim();
        if (cleanTitle.length < 3) {
            throw new Error("A valid certificate title is required (minimum 3 characters).");
        }

        if (recipients.length > MAX_RECIPIENTS_PER_BATCH) {
            throw new Error(`Batch size limit exceeded. Maximum allowable recipients per batch is ${MAX_RECIPIENTS_PER_BATCH}.`);
        }

        // Phase 13: Rate Limit Check (max 10 batch submissions per minute per club)
        if (!CertificateQueueService.checkRateLimit(clubId)) {
            throw new Error("Rate limit exceeded. Please wait a moment before submitting another certificate batch.");
        }

        // Phase 13: Idempotency deduplication check
        if (req.idempotencyKey) {
            const existingBatchId = await CertificateQueueService.findByIdempotencyKey(clubId, req.idempotencyKey);
            if (existingBatchId) {
                return {
                    batchId: existingBatchId,
                    totalRequested: recipients.length,
                    successfulCount: 0,
                    deduplicatedCount: 0,
                    teamCertificatesCount: 0,
                    individualCertificatesCount: 0,
                    skippedCount: 0,
                    failedCount: 0,
                    isAsync: true,
                    status: "processing",
                    issuedCertificates: [],
                    message: "Batch with this idempotency key is already queued or processing.",
                };
            }
        }

        // Fetch club details
        const clubRes = await query(
            `SELECT id, name, slug, college_name, logo_url FROM verified_clubs WHERE id = $1 LIMIT 1;`,
            [clubId]
        );
        const club = clubRes.rows[0];
        if (!club) throw new Error("Issuing club not found.");

        // Verify staff authorization for issuing club
        if (staffUserId) {
            const isAuthorized = await CertificateIssuanceService.verifyClubRole(staffUserId, clubId);
            if (!isAuthorized) {
                throw new Error("Access Denied: You do not have permission to issue certificates for this club.");
            }
        }

        // Resolve design: either from templateId or customDesign
        let design: CertificateDesign;
        let templateVersion = 1;
        let resolvedTemplateId: string | null = templateId || null;

        if (templateId) {
            const tmpl = await CertificateTemplateService.getTemplateById(templateId, clubId);
            if (!tmpl) throw new Error("Specified certificate template not found.");
            design = tmpl.design;
            templateVersion = tmpl.version;
        } else if (customDesign && Array.isArray(customDesign.elements)) {
            design = customDesign;
        } else {
            // Default to first system template
            let sysList = await CertificateTemplateService.getTemplates(clubId);
            if (sysList.systemTemplates.length === 0) {
                await CertificateTemplateService.seedSystemTemplates();
                sysList = await CertificateTemplateService.getTemplates(clubId);
            }
            const fallbackTmpl = sysList.systemTemplates[0];
            if (!fallbackTmpl) {
                throw new Error("No default certificate template available.");
            }
            design = fallbackTmpl.design;
            resolvedTemplateId = fallbackTmpl.id;
        }

        // If eventId provided, verify it belongs to this club and fetch details
        let eventRecord: any = null;
        if (eventId) {
            const evCheck = await query(
                `SELECT id, title, starts_at, venue_or_location FROM club_events WHERE id = $1 AND club_id = $2 LIMIT 1;`,
                [eventId, clubId]
            );
            if (!evCheck.rows[0]) {
                throw new Error("Specified event does not belong to this club.");
            }
            eventRecord = evCheck.rows[0];
        }

        // If teamId provided and not in teamSnapshots, load team record
        let teamRecord: any = null;
        if (teamId) {
            const teamCheck = await query(
                `SELECT id, name, slug FROM club_teams WHERE id = $1 AND club_id = $2 LIMIT 1;`,
                [teamId, clubId]
            );
            if (teamCheck.rows[0]) {
                teamRecord = teamCheck.rows[0];
            }
        }

        // =========================================================================
        // PHASE 12: DEDUPLICATION ENGINE & TEAM/INDIVIDUAL RECIPIENT RESOLUTION
        // =========================================================================
        // Auto-populate teamSnapshots from teamId if not explicitly passed
        const finalTeamSnapshots: Array<{
            teamId: string;
            teamName: string;
            teamSlug?: string;
            members: any[];
        }> = [...(teamSnapshots || [])];

        if (teamId && finalTeamSnapshots.length === 0) {
            const roster = await CertificateIssuanceService.getTeamRosterForReview(clubId, teamId, eventId || undefined);
            finalTeamSnapshots.push({
                teamId: roster.teamId,
                teamName: roster.teamName,
                teamSlug: roster.teamSlug,
                members: roster.members,
            });
        }

        // Determine issuance targets
        const willIssueTeams =
            (teamIssuanceMode === "team_only" || teamIssuanceMode === "both") && finalTeamSnapshots.length > 0;
        const willIssueIndividuals = teamIssuanceMode === "individual_only" || teamIssuanceMode === "both";

        // Deduplication map: user:userId or ext:email
        const deduplicatedIndividuals = new Map<string, any>();
        let deduplicatedCount = 0;

        function registerCandidate(cand: any) {
            const key = cand.userId
                ? `user:${cand.userId}`
                : `ext:${(cand.email || "").toLowerCase().trim()}`;
            if (!key || key === "ext:") return;

            if (deduplicatedIndividuals.has(key)) {
                deduplicatedCount++;
                const existing = deduplicatedIndividuals.get(key);
                // Merge non-empty fields
                if (!existing.customPosition && cand.customPosition) existing.customPosition = cand.customPosition;
                if (!existing.customName && cand.customName) existing.customName = cand.customName;
                if (!existing.customRole && cand.customRole) existing.customRole = cand.customRole;
                if (!existing.teamId && cand.teamId) {
                    existing.teamId = cand.teamId;
                    existing.teamName = cand.teamName;
                    existing.teamMembershipSnapshot = cand.teamMembershipSnapshot;
                }
            } else {
                deduplicatedIndividuals.set(key, { ...cand });
            }
        }

        // Register candidates from team members if issuing individual certificates
        if (willIssueIndividuals) {
            for (const tm of finalTeamSnapshots) {
                const teamMembershipSnapshot = (tm.members || []).map((m: any) => ({
                    userId: m.userId || null,
                    isExternal: Boolean(m.isExternal),
                    name: m.name || m.customName || "Team Member",
                    username: m.username || "",
                    email: maskEmail(m.email),
                    role: m.role || m.customRole || "Member",
                    customPosition: m.customPosition || awardPosition || "",
                }));

                for (const m of tm.members || []) {
                    registerCandidate({
                        userId: m.userId,
                        isExternal: Boolean(m.isExternal),
                        name: m.name || m.customName,
                        username: m.username,
                        email: m.email,
                        customName: m.customName,
                        customRole: m.role || m.customRole,
                        customPosition: m.customPosition || awardPosition,
                        teamId: tm.teamId,
                        teamName: tm.teamName,
                        teamMembershipSnapshot,
                    });
                }
            }

            // Register candidates from direct recipients
            for (const r of recipients) {
                registerCandidate({
                    userId: r.userId,
                    isExternal: Boolean(r.isExternal || (!r.userId && r.email)),
                    name: r.name || r.customName,
                    email: r.email,
                    customName: r.customName,
                    customRole: r.customRole,
                    customPosition: r.customPosition || awardPosition,
                    teamId: r.teamId || teamId || undefined,
                    teamName: r.teamName,
                });
            }
        }

        const candidateIndividuals = Array.from(deduplicatedIndividuals.values());

        if (!willIssueTeams && candidateIndividuals.length === 0) {
            throw new Error("At least one recipient or team must be specified for issuance.");
        }

        const registeredRecipientUserIds = candidateIndividuals
            .filter((c) => c.userId && !c.isExternal)
            .map((c) => c.userId as string);
        const externalRecipientsList = candidateIndividuals.filter((c) => c.isExternal || (!c.userId && c.email));

        let eligibleUsers: any[] = [];
        const unverifiedRecipients: any[] = [];

        if (willIssueIndividuals) {
            if (eventId) {
                // Event-Integrated Issuance: verify registration & attendance
                if (registeredRecipientUserIds.length > 0) {
                    const eligibleUsersRes = await query(
                        `SELECT
                            u.id,
                            u.email,
                            u.username,
                            COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                            COALESCE(inst.official_name, u.college) AS "collegeName",
                            reg.status AS "eventRegistrationStatus",
                            reg.checked_in_at AS "eventCheckedInAt"
                         FROM users u
                         LEFT JOIN institutions inst ON u.college_id = inst.id
                         LEFT JOIN club_event_registrations reg ON (reg.user_id = u.id AND reg.event_id = $2)
                         WHERE u.id = ANY($1::uuid[])
                           AND (
                             (u.college_id IS NOT NULL AND u.college_id = (SELECT college_id FROM verified_clubs WHERE id = $3))
                             OR EXISTS (SELECT 1 FROM club_event_registrations cer WHERE cer.club_id = $3 AND cer.user_id = u.id)
                             OR EXISTS (SELECT 1 FROM club_team_members ctm WHERE ctm.club_id = $3 AND ctm.user_id = u.id)
                             OR EXISTS (SELECT 1 FROM club_memberships cm WHERE cm.club_id = $3 AND cm.user_id = u.id)
                             OR u.id = (SELECT auth_user_id FROM verified_clubs WHERE id = $3)
                           );`,
                        [registeredRecipientUserIds, eventId, clubId]
                    );
                    eligibleUsers = eligibleUsersRes.rows;
                }

                // If certificateType is explicitly 'attendance', enforce verified attendance
                if (certificateType === "attendance") {
                    const strictlyAttended = eligibleUsers.filter(
                        (u) => u.eventRegistrationStatus === "attended" && u.eventCheckedInAt != null
                    );
                    const unverified = eligibleUsers.filter(
                        (u) => u.eventRegistrationStatus !== "attended" || u.eventCheckedInAt == null
                    );

                    if (unverified.length > 0) {
                        if (allowManualOverride && overrideReason?.trim()) {
                            unverifiedRecipients.push(...unverified);
                        } else {
                            eligibleUsers = strictlyAttended;
                        }
                    } else {
                        eligibleUsers = strictlyAttended;
                    }
                }

                if (eligibleUsers.length === 0 && externalRecipientsList.length === 0 && !willIssueTeams) {
                    throw new Error(
                        "None of the selected recipients have verified attendance evidence for this event. Registration alone is not proof of attendance. Please ensure attendees are checked in or inspect the eligibility exclusions."
                    );
                }
            } else {
                // Manual / Non-Event Issuance (Phase 11 & Phase 12):
                if (registeredRecipientUserIds.length > 0) {
                    const usersRes = await query(
                        `SELECT
                            u.id,
                            u.email,
                            u.username,
                            COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                            COALESCE(inst.official_name, u.college) AS "collegeName",
                            NULL AS "eventRegistrationStatus",
                            NULL AS "eventCheckedInAt"
                         FROM users u
                         LEFT JOIN institutions inst ON u.college_id = inst.id
                         WHERE u.id = ANY($1::uuid[]);`,
                        [registeredRecipientUserIds]
                    );
                    eligibleUsers = usersRes.rows;
                }
            }

            // Attach candidates metadata to eligibleUsers
            eligibleUsers = eligibleUsers.map((u) => {
                const matchCand = candidateIndividuals.find((c) => c.userId === u.id);
                return {
                    ...u,
                    customName: matchCand?.customName,
                    customRole: matchCand?.customRole,
                    customPosition: matchCand?.customPosition,
                    teamId: matchCand?.teamId,
                    teamName: matchCand?.teamName,
                    teamMembershipSnapshot: matchCand?.teamMembershipSnapshot,
                };
            });

            // Add external recipients
            for (const ext of externalRecipientsList) {
                eligibleUsers.push({
                    id: null,
                    isExternal: true,
                    email: ext.email?.trim() || "",
                    username: ext.email ? ext.email.split("@")[0] : "external",
                    name: ext.customName || ext.name || "External Recipient",
                    collegeName: club.college_name,
                    customPosition: ext.customPosition,
                    customRole: ext.customRole,
                    teamId: ext.teamId,
                    teamName: ext.teamName,
                    teamMembershipSnapshot: ext.teamMembershipSnapshot,
                });
            }
        }

        const totalBatchRecipients =
            (willIssueTeams ? finalTeamSnapshots.length : 0) + (willIssueIndividuals ? eligibleUsers.length : 0);

        if (totalBatchRecipients === 0) {
            throw new Error("No valid recipients or teams could be resolved for issuance.");
        }

        const clubSlugPrefix = (club.slug || club.name || "ORB")
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 5)
            .toUpperCase() || "ORB";
        const currentYear = new Date().getFullYear();

        const finalSignerName = signerName?.trim() || club.name || "Club Coordinator";
        const finalSignerRole = signerRole?.trim() || "Lead Coordinator";
        const cleanDesc = description?.trim() || (
            eventRecord
                ? `Awarded for active participation and demonstrated commitment in "${eventRecord.title}" conducted by ${club.name}.`
                : `Awarded in recognition of meritorious contribution, commitment, and skill demonstrated with ${club.name}.`
        );

        const isAsyncExecution = Boolean(req.asyncMode || totalBatchRecipients > 15);

        const batchPayloadData = {
            clubId,
            staffUserId,
            title: cleanTitle,
            certificateType,
            issuanceSource,
            eventId: eventId || undefined,
            teamId: teamId || undefined,
            awardPosition,
            description: cleanDesc,
            signerName: finalSignerName,
            signerRole: finalSignerRole,
            issueDate: req.issueDate,
            metadata: req.metadata,
            design,
            resolvedTemplateId,
            templateVersion,
            club,
            eventRecord,
            willIssueTeams,
            willIssueIndividuals,
            finalTeamSnapshots,
            eligibleUsers,
            unverifiedRecipients,
            allowManualOverride,
            overrideReason,
            recipientsOverrideMap: recipients,
        };

        // Create Batch Record
        const batchInsertRes = await query(
            `INSERT INTO certificate_batches (
                club_id, event_id, template_id, template_version, title,
                certificate_type, issuance_source, total_recipients, status, issued_by_user_id,
                batch_payload, idempotency_key
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12
            ) RETURNING id;`,
            [
                clubId,
                eventId || null,
                resolvedTemplateId,
                templateVersion,
                cleanTitle,
                certificateType,
                issuanceSource,
                totalBatchRecipients,
                isAsyncExecution ? "queued" : "processing",
                staffUserId,
                JSON.stringify(batchPayloadData),
                req.idempotencyKey || null,
            ]
        );
        const batchId = batchInsertRes.rows[0].id;

        // Phase 13: Bounded Concurrency Background Execution
        if (isAsyncExecution) {
            await CertificateQueueService.enqueueBatch({
                ...batchPayloadData,
                batchId,
            });

            return {
                batchId,
                totalRequested: totalBatchRecipients,
                successfulCount: 0,
                deduplicatedCount,
                teamCertificatesCount: 0,
                individualCertificatesCount: 0,
                skippedCount: 0,
                failedCount: 0,
                isAsync: true,
                status: "queued",
                issuedCertificates: [],
                message: `Certificate batch with ${totalBatchRecipients} recipients queued for asynchronous background generation.`,
            };
        }

        // Determine issue date (supports custom issue date)
        const targetIssueDate = req.issueDate ? new Date(req.issueDate) : new Date();
        const formattedIssueDate = targetIssueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        const issuedCertificates: any[] = [];
        let teamCertificatesCount = 0;
        let individualCertificatesCount = 0;
        const client = await pool.connect();

        // Phase 15: Aggregate awards per user for bulk grouped notification delivery
        const userAwardsMap = new Map<string, UserAwardsEntry>();

        try {
            await client.query("BEGIN");

            // =========================================================================
            // STEP 1: TEAM CERTIFICATE ISSUANCE (Phase 12)
            // =========================================================================
            if (willIssueTeams) {
                for (const tm of finalTeamSnapshots) {
                    const teamRandomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
                    const teamCredentialCode = `ORB-${clubSlugPrefix}-${currentYear}-${teamRandomHex}`;

                    const teamMembersSnapshot = (tm.members || []).map((m: any) => ({
                        userId: m.userId || null,
                        isExternal: Boolean(m.isExternal),
                        name: m.name || m.customName || "Team Member",
                        username: m.username || "",
                        email: maskEmail(m.email),
                        role: m.role || m.customRole || "Member",
                        customPosition: m.customPosition || awardPosition || "",
                    }));

                    const teamSnapshot: DynamicDataSnapshot = {
                        recipient: {
                            id: tm.teamId || "team",
                            name: tm.teamName,
                            username: tm.teamSlug || "team",
                            collegeName: club.college_name,
                        },
                        event: eventRecord
                            ? {
                                  id: eventRecord.id,
                                  title: eventRecord.title,
                                  date: eventRecord.starts_at ? new Date(eventRecord.starts_at).toLocaleDateString() : undefined,
                                  venue: eventRecord.venue_or_location || undefined,
                              }
                            : undefined,
                        club: {
                            id: club.id,
                            name: club.name,
                            slug: club.slug,
                            collegeName: club.college_name,
                            logoUrl: club.logo_url || undefined,
                        },
                        award: {
                            title: cleanTitle,
                            type: certificateType,
                            description: cleanDesc,
                            position: awardPosition || undefined,
                        },
                        team: {
                            id: tm.teamId,
                            name: tm.teamName,
                            memberCount: teamMembersSnapshot.length,
                            memberSnapshot: teamMembersSnapshot,
                        },
                        certificate: {
                            credentialCode: teamCredentialCode,
                            issueDate: formattedIssueDate,
                            verificationUrl: `https://orbix.dev/verify/certificate/${teamCredentialCode}`,
                            signerName: finalSignerName,
                            signerRole: finalSignerRole,
                        },
                    };

                    let teamSha256Digest: string | null = null;
                    try {
                        const renderRes = await CertificatePdfService.renderCertificatePdf(design, teamSnapshot);
                        teamSha256Digest = renderRes.sha256Hash;
                    } catch (pdfErr) {
                        console.error("PDF generation warning for team", tm.teamName, pdfErr);
                    }

                    const teamCertMetadataJson = JSON.stringify({
                        clubName: club.name,
                        clubSlug: club.slug,
                        collegeName: club.college_name,
                        eventTitle: eventRecord?.title || null,
                        teamName: tm.teamName,
                        isTeam: true,
                        teamId: tm.teamId,
                        position: awardPosition || null,
                        achievement: certificateType,
                        issuanceSource,
                        teamMembershipSnapshot: teamMembersSnapshot,
                        supportingMetadata: req.metadata || {},
                    });

                    const teamCertInsertRes = await client.query(
                        `INSERT INTO club_certificates (
                            club_id, user_id, event_id, template_id, template_version,
                            batch_id, team_id, title, certificate_type, recipient_name,
                            recipient_email, description, credential_code, signer_name,
                            signer_role, issued_by_user_id, issue_date, design_snapshot,
                            recipient_snapshot, sha256_hash, metadata, claim_status, version,
                            recipient_type
                        ) VALUES (
                            $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9,
                            NULL, $10, $11, $12, $13, $14, $15, $16::jsonb,
                            $17::jsonb, $18, $19::jsonb, 'claimed', 1,
                            'team'
                        )
                        ON CONFLICT (club_id, team_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title)
                        WHERE team_id IS NOT NULL AND user_id IS NULL AND claim_token IS NULL
                        DO UPDATE SET
                            description = EXCLUDED.description,
                            signer_name = EXCLUDED.signer_name,
                            signer_role = EXCLUDED.signer_role,
                            design_snapshot = EXCLUDED.design_snapshot,
                            recipient_snapshot = EXCLUDED.recipient_snapshot,
                            sha256_hash = EXCLUDED.sha256_hash,
                            updated_at = NOW()
                        RETURNING id, credential_code, title, certificate_type, issue_date;`,
                        [
                            club.id,
                            eventId || null,
                            resolvedTemplateId,
                            templateVersion,
                            batchId,
                            tm.teamId,
                            cleanTitle,
                            certificateType,
                            tm.teamName,
                            cleanDesc,
                            teamCredentialCode,
                            finalSignerName,
                            finalSignerRole,
                            staffUserId,
                            targetIssueDate,
                            JSON.stringify(design),
                            JSON.stringify(teamSnapshot),
                            teamSha256Digest,
                            teamCertMetadataJson,
                        ]
                    );

                    const teamCert = teamCertInsertRes.rows[0];
                    issuedCertificates.push({
                        id: teamCert.id,
                        isTeam: true,
                        teamId: tm.teamId,
                        teamName: tm.teamName,
                        recipientId: null,
                        recipientName: tm.teamName,
                        credentialCode: teamCert.credential_code,
                        sha256Hash: teamSha256Digest || undefined,
                    });
                    teamCertificatesCount++;

                    // Collect for recipient notification delivery (Phase 15)
                    for (const member of tm.members || []) {
                        if (member.userId) {
                            if (!userAwardsMap.has(member.userId)) {
                                userAwardsMap.set(member.userId, {
                                    user: { id: member.userId, username: member.username || member.name, name: member.name },
                                    certs: [],
                                });
                            }
                            userAwardsMap.get(member.userId)!.certs.push({
                                id: teamCert.id,
                                credential_code: teamCert.credential_code,
                                title: cleanTitle,
                                certificate_type: certificateType,
                                recipient_name: tm.teamName,
                                issue_date: teamCert.issue_date,
                                sha256_hash: teamSha256Digest || undefined,
                                isTeam: true,
                                teamName: tm.teamName,
                                awardPosition: awardPosition || undefined,
                            });
                        }
                    }
                }
            }

            // =========================================================================
            // STEP 2: INDIVIDUAL CERTIFICATE ISSUANCE (Phase 12)
            // =========================================================================
            if (willIssueIndividuals) {
                for (const user of eligibleUsers) {
                    // Find matching custom overrides from request if any
                    const customOverrides = recipients.find((r) => r.userId === user.id);
                    const recipientDisplayName = customOverrides?.customName?.trim() || customOverrides?.name?.trim() || user.name;
                    const recipientPosition = customOverrides?.customPosition?.trim() || awardPosition || "";

                    const userTeamId = user.teamId || teamRecord?.id;
                    const userTeamName = user.teamName || teamRecord?.name;
                    const userTeamRole = user.customRole || customOverrides?.customRole;
                    const userTeamSnapshot = user.teamMembershipSnapshot;

                    // Generate unique verifiable credential code
                    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
                    const credentialCode = `ORB-${clubSlugPrefix}-${currentYear}-${randomHex}`;

                    // Phase 11: Support external recipient verified claim token
                    const isExternal = Boolean(user.isExternal);
                    const claimToken = isExternal ? crypto.randomBytes(24).toString("hex") : null;
                    const claimUrl = isExternal ? `https://orbix.dev/verify/certificate/claim/${claimToken}` : null;

                    // Assemble immutable snapshot
                    const snapshot: DynamicDataSnapshot = {
                        recipient: {
                            id: user.id || undefined,
                            name: recipientDisplayName,
                            username: user.username,
                            email: user.email,
                            collegeName: user.collegeName || club.college_name,
                        },
                        event: eventRecord
                            ? {
                                  id: eventRecord.id,
                                  title: eventRecord.title,
                                  date: eventRecord.starts_at ? new Date(eventRecord.starts_at).toLocaleDateString() : undefined,
                                  venue: eventRecord.venue_or_location || undefined,
                              }
                            : undefined,
                        club: {
                            id: club.id,
                            name: club.name,
                            slug: club.slug,
                            collegeName: club.college_name,
                            logoUrl: club.logo_url || undefined,
                        },
                        award: {
                            title: cleanTitle,
                            type: certificateType,
                            description: cleanDesc,
                            position: recipientPosition || undefined,
                        },
                        team: userTeamId
                            ? {
                                  id: userTeamId,
                                  name: userTeamName,
                                  role: userTeamRole || undefined,
                                  memberSnapshot: userTeamSnapshot || undefined,
                              }
                            : undefined,
                        certificate: {
                            credentialCode,
                            issueDate: formattedIssueDate,
                            verificationUrl: `https://orbix.dev/verify/certificate/${credentialCode}`,
                            signerName: finalSignerName,
                            signerRole: finalSignerRole,
                        },
                    };

                    // Authoritative server-side rendering of PDF & cryptographic hash
                    let sha256Digest: string | null = null;
                    try {
                        const renderRes = await CertificatePdfService.renderCertificatePdf(design, snapshot);
                        sha256Digest = renderRes.sha256Hash;
                    } catch (pdfErr) {
                        console.error("PDF generation warning for recipient", recipientDisplayName, pdfErr);
                    }

                    // Insert into club_certificates with immutable snapshots
                    let certInsertRes: any;
                    const certMetadataJson = JSON.stringify({
                        clubName: club.name,
                        clubSlug: club.slug,
                        collegeName: club.college_name,
                        eventTitle: eventRecord?.title || null,
                        teamName: userTeamName || null,
                        position: recipientPosition || null,
                        achievement: certificateType,
                        issuanceSource,
                        isExternal,
                        claimToken: claimToken || null,
                        claimUrl: claimUrl || null,
                        teamMembershipSnapshot: userTeamSnapshot || null,
                        supportingMetadata: req.metadata || {},
                    });

                    if (isExternal) {
                        // External recipient claim workflow (Phase 11)
                        certInsertRes = await client.query(
                            `INSERT INTO club_certificates (
                                club_id, user_id, event_id, template_id, template_version,
                                batch_id, team_id, title, certificate_type, recipient_name,
                                recipient_email, description, credential_code, signer_name,
                                signer_role, issued_by_user_id, issue_date, design_snapshot,
                                recipient_snapshot, sha256_hash, metadata, claim_token, claim_status, claim_expires_at,
                                recipient_type
                            ) VALUES (
                                $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9,
                                $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
                                $18::jsonb, $19, $20::jsonb, $21, 'pending_claim', NOW() + INTERVAL '60 days',
                                'external'
                            ) RETURNING id, credential_code, title, certificate_type, issue_date;`,
                            [
                                club.id,
                                eventId || null,
                                resolvedTemplateId,
                                templateVersion,
                                batchId,
                                userTeamId || null,
                                cleanTitle,
                                certificateType,
                                recipientDisplayName,
                                user.email,
                                cleanDesc,
                                credentialCode,
                                finalSignerName,
                                finalSignerRole,
                                staffUserId,
                                targetIssueDate,
                                JSON.stringify(design),
                                JSON.stringify(snapshot),
                                sha256Digest,
                                certMetadataJson,
                                claimToken,
                            ]
                        );
                    } else {
                        // Registered Orbix user issuance
                        certInsertRes = await client.query(
                            `INSERT INTO club_certificates (
                                club_id, user_id, event_id, template_id, template_version,
                                batch_id, team_id, title, certificate_type, recipient_name,
                                recipient_email, description, credential_code, signer_name,
                                signer_role, issued_by_user_id, issue_date, design_snapshot,
                                recipient_snapshot, sha256_hash, metadata, claim_status, version,
                                recipient_type
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
                                $19::jsonb, $20, $21::jsonb, 'claimed', 1,
                                'individual'
                            )
                            ON CONFLICT (club_id, user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title, version)
                            DO UPDATE SET
                                description = EXCLUDED.description,
                                signer_name = EXCLUDED.signer_name,
                                signer_role = EXCLUDED.signer_role,
                                design_snapshot = EXCLUDED.design_snapshot,
                                recipient_snapshot = EXCLUDED.recipient_snapshot,
                                sha256_hash = EXCLUDED.sha256_hash,
                                updated_at = NOW()
                            RETURNING id, credential_code, title, certificate_type, issue_date;`,
                            [
                                club.id,
                                user.id,
                                eventId || null,
                                resolvedTemplateId,
                                templateVersion,
                                batchId,
                                userTeamId || null,
                                cleanTitle,
                                certificateType,
                                recipientDisplayName,
                                user.email,
                                cleanDesc,
                                credentialCode,
                                finalSignerName,
                                finalSignerRole,
                                staffUserId,
                                targetIssueDate,
                                JSON.stringify(design),
                                JSON.stringify(snapshot),
                                sha256Digest,
                                certMetadataJson,
                            ]
                        );
                    }

                    const cert = certInsertRes.rows[0];
                    issuedCertificates.push({
                        id: cert.id,
                        isTeam: false,
                        teamId: userTeamId || undefined,
                        teamName: userTeamName || undefined,
                        recipientId: user.id || "external",
                        recipientName: recipientDisplayName,
                        credentialCode: cert.credential_code,
                        sha256Hash: sha256Digest || undefined,
                        claimToken: claimToken || undefined,
                    });
                    individualCertificatesCount++;

                    // Phase 15: Collect for recipient notification delivery
                    if (user.id && !isExternal) {
                        if (!userAwardsMap.has(user.id)) {
                            userAwardsMap.set(user.id, {
                                user: { id: user.id, username: user.username, name: recipientDisplayName },
                                certs: [],
                            });
                        }
                        userAwardsMap.get(user.id)!.certs.push({
                            id: cert.id,
                            credential_code: cert.credential_code,
                            title: cleanTitle,
                            certificate_type: certificateType,
                            recipient_name: recipientDisplayName,
                            issue_date: cert.issue_date,
                            sha256_hash: sha256Digest || undefined,
                            awardPosition: recipientPosition || undefined,
                        });
                    }
                }
            }

            // Phase 15: Dispatch grouped bulk / individual certificate notifications
            await CertificateIssuanceService.dispatchCertificateNotifications(client, {
                club,
                eventRecord,
                batchId,
                userAwardsMap,
            });

            // Update batch record to completed
            await client.query(
                `UPDATE certificate_batches SET
                    status = 'completed',
                    successful_count = $1,
                    failed_count = $2,
                    updated_at = NOW()
                 WHERE id = $3;`,
                [issuedCertificates.length, 0, batchId]
            );

            // Record audit log for batch issuance (Phase 17 & 18)
            await client.query(
                `INSERT INTO certificate_audit_logs (
                    club_id, actor_user_id, action, entity_type, entity_id, metadata
                ) VALUES ($1, $2, 'certificate_batch_issued', 'certificate_batch', $3, $4::jsonb);`,
                [
                    club.id,
                    staffUserId,
                    batchId,
                    JSON.stringify({
                        title: cleanTitle,
                        certificateType,
                        issuanceSource,
                        teamIssuanceMode,
                        eventId: eventId || null,
                        totalRecipients: totalBatchRecipients,
                        issuedCount: issuedCertificates.length,
                        teamCertificatesCount,
                        individualCertificatesCount,
                        deduplicatedCount,
                        overrideCount: unverifiedRecipients.length,
                    }),
                ]
            );

            // Record manual attendance overrides in audit log if any (Phase 10 & 18)
            for (const unv of unverifiedRecipients) {
                await client.query(
                    `INSERT INTO certificate_audit_logs (
                        club_id, actor_user_id, action, entity_type, entity_id, metadata
                    ) VALUES ($1, $2, 'manual_attendance_override', 'certificate_recipient', $3, $4::jsonb);`,
                    [
                        club.id,
                        staffUserId,
                        unv.id,
                        JSON.stringify({
                            batchId: batchInsertRes.rows[0].id,
                            eventId,
                            userId: unv.id,
                            userName: unv.name,
                            certificateType,
                            reason: overrideReason?.trim() || "Manual coordinator override",
                            overrideReason: overrideReason?.trim() || "Manual coordinator override",
                        }),
                    ]
                );
            }

            await client.query("COMMIT");
        } catch (txnErr) {
            await client.query("ROLLBACK");
            await query(
                `UPDATE certificate_batches SET status = 'failed', error_log = $1::jsonb WHERE id = $2;`,
                [JSON.stringify([{ error: (txnErr as any).message }]), batchId]
            );
            throw txnErr;
        } finally {
            client.release();
        }

        // Credibility Engine Evidence Logging
        if (issuedCertificates.length > 0) {
            ClubCredibilityService.recordCredibilityEvent({
                clubId: club.id,
                eventId: eventId ? String(eventId) : undefined,
                sourceAction: "certificate_issued",
                reasonCode: "verified_credentials_awarded",
                outcomeQuality: 92,
                weightInputs: {
                    baseWeight: 0.85,
                    scope: "CAMPUS",
                    verifiedAttendees: issuedCertificates.length,
                    isNegativeOutcome: false,
                },
                factorBreakdown: {
                    issuedCount: issuedCertificates.length,
                    teamCertificatesCount,
                    individualCertificatesCount,
                    deduplicatedCount,
                    certificateType,
                    batchId,
                },
                actorId: staffUserId,
                idempotencyKey: `batch_${batchId}`,
            }).catch((err) => console.error("[Credibility] Record certificate batch error:", err));
        }

        const totalRequested = (willIssueTeams ? finalTeamSnapshots.length : 0) + (recipients.length || 0);
        const skippedCount = Math.max(0, totalRequested - issuedCertificates.length);

        return {
            batchId,
            totalRequested,
            successfulCount: issuedCertificates.length,
            skippedCount,
            failedCount: 0,
            issuedCertificates,
            deduplicatedCount,
            teamCertificatesCount,
            individualCertificatesCount,
            message: `Successfully issued ${issuedCertificates.length} verified digital credential(s) (${teamCertificatesCount} team, ${individualCertificatesCount} individual).`,
        };
    }

    /**
     * Retrieves external claim details without exposing private credentials (Phase 11)
     */
    static async getClaimDetails(claimToken: string) {
        const res = await query(
            `SELECT
                c.id, c.title, c.certificate_type AS "certificateType",
                c.recipient_name AS "recipientName", c.recipient_email AS "recipientEmail",
                c.description, c.credential_code AS "credentialCode",
                c.issue_date AS "issueDate", c.claim_status AS "claimStatus",
                c.claim_expires_at AS "claimExpiresAt",
                vc.name AS "clubName", vc.slug AS "clubSlug",
                vc.college_name AS "collegeName", vc.logo_url AS "clubLogoUrl",
                e.title AS "eventTitle"
             FROM club_certificates c
             JOIN verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN club_events e ON e.id = c.event_id
             WHERE c.claim_token = $1
             LIMIT 1;`,
            [claimToken]
        );

        if (!res.rows[0]) return null;

        const row = res.rows[0];
        const isExpired = row.claimExpiresAt && new Date(row.claimExpiresAt) < new Date();
        const effectiveStatus = isExpired && row.claimStatus === "pending_claim" ? "expired" : row.claimStatus;

        return {
            id: row.id,
            title: row.title,
            certificateType: row.certificateType,
            recipientName: row.recipientName,
            recipientEmailMasked: maskEmail(row.recipientEmail),
            description: row.description,
            credentialCode: row.credentialCode,
            issueDate: row.issueDate,
            claimStatus: effectiveStatus,
            claimExpiresAt: row.claimExpiresAt,
            clubName: row.clubName,
            clubSlug: row.clubSlug,
            collegeName: row.collegeName,
            clubLogoUrl: row.clubLogoUrl,
            eventTitle: row.eventTitle,
        };
    }

    /**
     * Authenticated recipient claim workflow: links external certificate to registered Orbix user (Phase 11)
     */
    static async claimCertificate(claimToken: string, userId: string) {
        // 1. Fetch user info
        const userRes = await query(
            `SELECT id, username, email, firstname, lastname, photo_url, avatar_url, college_id, college
             FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) throw new Error("Authenticated user not found.");

        // 2. Fetch certificate
        const certRes = await query(
            `SELECT c.id, c.club_id, c.title, c.certificate_type, c.recipient_name, c.recipient_email,
                    c.credential_code, c.claim_status, c.claim_expires_at, c.recipient_snapshot,
                    vc.name AS "clubName", vc.slug AS "clubSlug"
             FROM club_certificates c
             JOIN verified_clubs vc ON vc.id = c.club_id
             WHERE c.claim_token = $1
             LIMIT 1;`,
            [claimToken]
        );
        const cert = certRes.rows[0];
        if (!cert) throw new Error("Certificate claim token is invalid or has expired.");

        if (cert.claim_status === "claimed") {
            throw new Error("This certificate has already been claimed.");
        }
        if (cert.claim_expires_at && new Date(cert.claim_expires_at) < new Date()) {
            throw new Error("This certificate claim link has expired (claim period is 60 days).");
        }

        // Check if user already holds a certificate with this title/type/club/event combination
        const duplicateCheck = await query(
            `SELECT id, credential_code FROM club_certificates
             WHERE club_id = $1 AND user_id = $2
               AND COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
               AND certificate_type = $4 AND title = $5
             LIMIT 1;`,
            [cert.club_id, user.id, cert.event_id, cert.certificate_type, cert.title]
        );
        if (duplicateCheck.rows.length > 0) {
            throw new Error("You already hold this certificate in your wallet.");
        }

        // 3. Update recipient_snapshot to associate the user
        let updatedSnapshot = cert.recipient_snapshot || {};
        if (typeof updatedSnapshot === "string") {
            try { updatedSnapshot = JSON.parse(updatedSnapshot); } catch {}
        }
        if (!updatedSnapshot.recipient) updatedSnapshot.recipient = {};
        updatedSnapshot.recipient.id = user.id;
        updatedSnapshot.recipient.username = user.username;
        if (!updatedSnapshot.recipient.collegeName) {
            updatedSnapshot.recipient.collegeName = user.college;
        }

        // 4. Update certificate record
        await query(
            `UPDATE club_certificates
             SET user_id = $1,
                 claim_status = 'claimed',
                 recipient_snapshot = $2::jsonb,
                 updated_at = NOW()
             WHERE id = $3;`,
            [user.id, JSON.stringify(updatedSnapshot), cert.id]
        );

        // 5. Create notification for the user
        const notifTitle = `🎓 Certificate Claimed Successfully!`;
        const notifBody = `You have claimed the "${cert.title}" certificate from ${cert.clubName}. It is now in your certificate wallet.`;
        await query(
            `INSERT INTO user_notifications (
                user_id, recipient_id, username, title, body,
                type, notification_type, metadata, idempotency_key, is_read, created_at
            ) VALUES (
                $1, $1, $2, $3, $4,
                'club_certificate', 'certificate_claimed', $5::jsonb, $6, false, NOW()
            )
            ON CONFLICT (idempotency_key) DO UPDATE SET
                title = EXCLUDED.title,
                body = EXCLUDED.body;`,
            [
                user.id,
                user.username,
                notifTitle,
                notifBody,
                JSON.stringify({
                    type: "club_certificate",
                    certificateId: cert.id,
                    credentialCode: cert.credential_code,
                    clubId: cert.club_id,
                    clubName: cert.clubName,
                    clubSlug: cert.clubSlug,
                    certificateType: cert.certificate_type,
                    title: cert.title,
                    isSpoiler: false,
                    isRevealed: true,
                }),
                `claim-cert-${cert.id}`,
            ]
        );

        // 6. Record audit log
        await query(
            `INSERT INTO certificate_audit_logs (
                club_id, actor_user_id, action, entity_type, entity_id, metadata
            ) VALUES ($1, $2, 'certificate_claimed_by_external_user', 'club_certificate', $3, $4::jsonb);`,
            [
                cert.club_id,
                user.id,
                cert.id,
                JSON.stringify({
                    claimedByEmail: user.email,
                    claimedByUsername: user.username,
                    credentialCode: cert.credential_code,
                    claimToken,
                }),
            ]
        );

        return {
            id: cert.id,
            credentialCode: cert.credential_code,
            title: cert.title,
            recipientName: cert.recipient_name,
            message: "Certificate claimed successfully and linked to your profile.",
        };
    }

    /**
     * Dispatches certificate notifications to recipients (Phase 15)
     */
    static async dispatchCertificateNotifications(
        dbClient: { query: (sql: string, params?: any[]) => Promise<any> },
        params: {
            club: { id: string; name: string; slug: string; logo_url?: string };
            eventRecord: { id?: string; title: string } | null;
            batchId: string;
            userAwardsMap: Map<string, UserAwardsEntry>;
        }
    ): Promise<void> {
        return CertificateNotificationService.dispatchCertificateNotifications(dbClient, params);
    }
}
