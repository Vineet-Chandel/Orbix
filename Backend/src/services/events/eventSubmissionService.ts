import { query } from "../../database/client.js";
import { cloudinary, isCloudinaryConfigured, assertCloudinaryConfigured } from "../../config/cloudinary.js";
import { EventNotificationService } from "./eventNotificationService.js";

export interface StageSubmissionInput {
    stageId: string;
    eventId: string;
    registrationId: string;
    userId: string;
    teamId?: string | null;
    title?: string;
    description?: string;
    answers?: Record<string, any>;
    githubUrl?: string;
    liveUrl?: string;
    videoUrl?: string;
    status?: "draft" | "submitted";
    assets?: Array<{
        cloudinaryPublicId: string;
        cloudinaryUrl: string;
        cloudinarySecureUrl: string;
        originalFilename: string;
        fileFormat: string;
        mimeType?: string;
        fileSizeBytes?: number;
        resourceType?: string;
    }>;
}

export class EventSubmissionService {
    /**
     * Get dynamic submission form configuration for a specific stage
     */
    static async getStageForm(stageId: string): Promise<any | null> {
        const res = await query(
            `SELECT * FROM club_event_stage_forms WHERE stage_id = $1 LIMIT 1;`,
            [stageId]
        );
        return res.rows[0] || null;
    }

    /**
     * Create or update dynamic submission form for a stage
     */
    static async saveStageForm(
        stageId: string,
        eventId: string,
        formData: {
            title: string;
            description?: string;
            fields: any[];
            allowedFileTypes?: string[];
            maxFileSizeBytes?: number;
            maxFiles?: number;
        }
    ): Promise<any> {
        const res = await query(
            `INSERT INTO club_event_stage_forms (
                stage_id, event_id, title, description, fields, allowed_file_types, max_file_size_bytes, max_files
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (stage_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                fields = EXCLUDED.fields,
                allowed_file_types = EXCLUDED.allowed_file_types,
                max_file_size_bytes = EXCLUDED.max_file_size_bytes,
                max_files = EXCLUDED.max_files,
                updated_at = NOW()
             RETURNING *;`,
            [
                stageId,
                eventId,
                formData.title.trim(),
                formData.description || null,
                JSON.stringify(formData.fields || []),
                JSON.stringify(formData.allowedFileTypes || ["pdf", "png", "jpg", "jpeg", "docx", "pptx", "zip"]),
                formData.maxFileSizeBytes || 26214400,
                formData.maxFiles || 5,
            ]
        );

        return res.rows[0];
    }

    /**
     * Generate secure Cloudinary signed upload parameters for participant stage deliverables
     */
    static async requestUploadSignature(
        eventId: string,
        stageId: string,
        userId: string,
        filename: string,
        format: string
    ): Promise<any> {
        assertCloudinaryConfigured();

        const cleanExt = (format || filename.split(".").pop() || "raw").toLowerCase().replace(/^\./, "");
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = `orbix/events/${eventId}/stages/${stageId}/${userId}`;
        const publicId = `${folder}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

        const apiSecret = process.env.CLOUDINARY_API_SECRET!;
        const apiKey = process.env.CLOUDINARY_API_KEY!;
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

        // Signed upload params
        const paramsToSign: Record<string, any> = {
            folder,
            public_id: publicId,
            timestamp,
        };

        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

        return {
            signature,
            timestamp,
            apiKey,
            cloudName,
            folder,
            publicId,
            resourceType: ["jpg", "jpeg", "png", "webp"].includes(cleanExt) ? "image" : "raw",
        };
    }

    /**
     * Submit or save draft deliverables for a stage with server-side validation
     */
    static async submitStageDeliverable(input: StageSubmissionInput): Promise<any> {
        // 1. Fetch stage and check schedule and eligibility
        const stageRes = await query(
            `SELECT s.*, e.title AS event_title, c.name AS club_name 
             FROM club_event_stages s
             JOIN club_events e ON e.id = s.event_id
             JOIN verified_clubs c ON c.id = s.club_id
             WHERE s.id = $1 AND s.event_id = $2;`,
            [input.stageId, input.eventId]
        );

        if (stageRes.rows.length === 0) throw new Error("Stage not found");
        const stage = stageRes.rows[0];

        // 2. Deadline & Status validation
        const now = new Date();
        if (stage.status !== "active") {
            if (stage.status === "paused") {
                throw new Error("This round is temporarily paused by the organizers.");
            }
            if (now > new Date(stage.ends_at)) {
                throw new Error("The submission deadline for this round has closed.");
            }
            if (now < new Date(stage.starts_at)) {
                throw new Error("This round has not yet started.");
            }
        }

        // 3. Participant Registration & Eligibility validation
        const regRes = await query(
            `SELECT r.*, u.name AS user_name, u.email AS user_email
             FROM club_event_registrations r
             JOIN users u ON u.id = r.user_id
             WHERE r.id = $1 AND r.event_id = $2 AND (r.user_id = $3 OR r.team_id = $4);`,
            [input.registrationId, input.eventId, input.userId, input.teamId || null]
        );

        if (regRes.rows.length === 0) throw new Error("Invalid or unverified event registration record");
        const registration = regRes.rows[0];

        if (registration.status !== "registered" && registration.status !== "attended") {
            throw new Error(`Your event application status (${registration.status}) does not permit stage submission.`);
        }

        // 4. Shortlisting check
        if (stage.eligibility_type === "shortlisted_only") {
            const advRes = await query(
                `SELECT id FROM club_event_stage_advancements 
                 WHERE to_stage_id = $1 AND registration_id = $2 AND status IN ('shortlisted', 'advanced');`,
                [stage.id, registration.id]
            );
            if (advRes.rows.length === 0) {
                throw new Error("You have not been shortlisted for this advanced round.");
            }
        }

        // 5. Team leadership submission check
        if (stage.requirements?.teamSubmissionOnly && stage.requirements?.leaderOnlySubmit && registration.team_id) {
            const teamRes = await query(
                `SELECT leader_id FROM club_event_teams WHERE id = $1;`,
                [registration.team_id]
            );
            if (teamRes.rows.length > 0 && teamRes.rows[0].leader_id !== input.userId) {
                throw new Error("Only the designated Team Leader can submit materials for this round.");
            }
        }

        const status = input.status || "submitted";

        // 6. Upsert submission
        const subRes = await query(
            `INSERT INTO club_event_stage_submissions (
                stage_id, event_id, registration_id, team_id, user_id, title, description,
                answers, github_url, live_url, video_url, status, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             ON CONFLICT (stage_id, registration_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                answers = EXCLUDED.answers,
                github_url = EXCLUDED.github_url,
                live_url = EXCLUDED.live_url,
                video_url = EXCLUDED.video_url,
                status = EXCLUDED.status,
                version = club_event_stage_submissions.version + 1,
                updated_at = NOW()
             RETURNING *;`,
            [
                input.stageId,
                input.eventId,
                input.registrationId,
                input.teamId || registration.team_id || null,
                input.userId,
                input.title || null,
                input.description || null,
                JSON.stringify(input.answers || {}),
                input.githubUrl || null,
                input.liveUrl || null,
                input.videoUrl || null,
                status,
            ]
        );

        const submission = subRes.rows[0];

        // 7. Save and link uploaded Cloudinary assets
        if (input.assets && input.assets.length > 0) {
            // Delete old assets for this submission to maintain clean state
            await query(`DELETE FROM club_event_submission_assets WHERE submission_id = $1;`, [submission.id]);

            for (const asset of input.assets) {
                await query(
                    `INSERT INTO club_event_submission_assets (
                        submission_id, stage_id, event_id, user_id, cloudinary_public_id,
                        cloudinary_url, cloudinary_secure_url, original_filename, file_format,
                        mime_type, file_size_bytes, resource_type
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
                    [
                        submission.id,
                        input.stageId,
                        input.eventId,
                        input.userId,
                        asset.cloudinaryPublicId,
                        asset.cloudinaryUrl,
                        asset.cloudinarySecureUrl,
                        asset.originalFilename,
                        asset.fileFormat,
                        asset.mimeType || "application/octet-stream",
                        asset.fileSizeBytes || 0,
                        asset.resourceType || "raw",
                    ]
                );
            }
        }

        // 8. If finalized submission, dispatch submission receipt email
        if (status === "submitted") {
            const recipientEmail = registration.applicant_email || registration.user_email;
            if (recipientEmail) {
                EventNotificationService.dispatchEventEmail({
                    eventId: input.eventId,
                    stageId: input.stageId,
                    triggerType: "submission_received",
                    recipientEmail,
                    recipientUserId: input.userId,
                    participantName: registration.applicant_name || registration.user_name || "Participant",
                    eventTitle: stage.event_title,
                    clubName: stage.club_name,
                    stageName: stage.name,
                    headline: `Submission Confirmed: ${stage.name}`,
                    message: `We have received your deliverables for ${stage.name}. Keep your receipt code handy for reference.`,
                    receiptCode: submission.receipt_code,
                    badgeText: "Deliverable Received",
                }).catch(console.error);
            }
        }

        return submission;
    }

    /**
     * Get a participant's submission for a stage
     */
    static async getParticipantSubmission(stageId: string, registrationId: string): Promise<any | null> {
        const subRes = await query(
            `SELECT sub.*, 
                json_agg(
                    json_build_object(
                        'id', a.id,
                        'cloudinaryPublicId', a.cloudinary_public_id,
                        'cloudinaryUrl', a.cloudinary_url,
                        'cloudinarySecureUrl', a.cloudinary_secure_url,
                        'originalFilename', a.original_filename,
                        'fileFormat', a.file_format,
                        'mimeType', a.mime_type,
                        'fileSizeBytes', a.file_size_bytes
                    )
                ) FILTER (WHERE a.id IS NOT NULL) AS assets
             FROM club_event_stage_submissions sub
             LEFT JOIN club_event_submission_assets a ON a.submission_id = sub.id
             WHERE sub.stage_id = $1 AND sub.registration_id = $2
             GROUP BY sub.id;`,
            [stageId, registrationId]
        );

        return subRes.rows[0] || null;
    }

    /**
     * Organizer: Get all submissions for a stage
     */
    static async getStageSubmissions(stageId: string, eventId: string): Promise<any[]> {
        const res = await query(
            `SELECT 
                sub.*,
                r.applicant_name,
                r.applicant_email,
                r.phone_number,
                r.institution_name,
                t.name AS team_name,
                u.username,
                (SELECT count(*) FROM club_event_evaluations ev WHERE ev.submission_id = sub.id)::int AS evaluation_count,
                (SELECT avg(ev.total_score) FROM club_event_evaluations ev WHERE ev.submission_id = sub.id)::numeric(5,2) AS average_score,
                json_agg(
                    json_build_object(
                        'id', a.id,
                        'cloudinaryPublicId', a.cloudinary_public_id,
                        'cloudinaryUrl', a.cloudinary_url,
                        'cloudinarySecureUrl', a.cloudinary_secure_url,
                        'originalFilename', a.original_filename,
                        'fileFormat', a.file_format,
                        'fileSizeBytes', a.file_size_bytes
                    )
                ) FILTER (WHERE a.id IS NOT NULL) AS assets
             FROM club_event_stage_submissions sub
             JOIN club_event_registrations r ON r.id = sub.registration_id
             JOIN users u ON u.id = sub.user_id
             LEFT JOIN club_event_teams t ON t.id = sub.team_id
             LEFT JOIN club_event_submission_assets a ON a.submission_id = sub.id
             WHERE sub.stage_id = $1 AND sub.event_id = $2
             GROUP BY sub.id, r.applicant_name, r.applicant_email, r.phone_number, r.institution_name, t.name, u.username
             ORDER BY sub.submitted_at DESC;`,
            [stageId, eventId]
        );

        return res.rows;
    }
}
