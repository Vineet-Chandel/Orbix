import crypto from "crypto";
import { query } from "../../database/client.js";
import { CertificatePdfService } from "./certificatePdfService.js";
import { ClubCredibilityService } from "./clubCredibilityService.js";
import type { CertificateDesign, DynamicDataSnapshot } from "../../types/certificateStudio.js";

export interface BatchProgressInfo {
    id: string;
    clubId: string;
    title: string;
    status: "queued" | "processing" | "completed" | "partially_failed" | "failed";
    totalRecipients: number;
    processedCount: number;
    successfulCount: number;
    failedCount: number;
    progressPercentage: number;
    currentThroughput: number; // certs/sec
    errorLog: Array<{
        recipientName?: string | undefined;
        email?: string | undefined;
        error: string;
        timestamp: string;
    }>;
    isRecoverable: boolean;
    canRetry: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface EnqueueBatchJobParams {
    batchId: string;
    clubId: string;
    staffUserId: string;
    title: string;
    certificateType: string;
    issuanceSource: string;
    eventId?: string | undefined;
    teamId?: string | undefined;
    awardPosition?: string | undefined;
    description?: string | undefined;
    signerName?: string | undefined;
    signerRole?: string | undefined;
    issueDate?: string | undefined;
    metadata?: any;
    design: CertificateDesign;
    resolvedTemplateId: string | null;
    templateVersion: number;
    club: any;
    eventRecord: any;
    willIssueTeams: boolean;
    willIssueIndividuals: boolean;
    finalTeamSnapshots: any[];
    eligibleUsers: any[];
    unverifiedRecipients?: any[] | undefined;
    allowManualOverride?: boolean | undefined;
    overrideReason?: string | undefined;
    recipientsOverrideMap?: any[] | undefined;
}

interface InFlightJobState {
    batchId: string;
    clubId: string;
    title: string;
    totalRecipients: number;
    processedCount: number;
    successfulCount: number;
    failedCount: number;
    startTime: number;
    lastUpdateTime: number;
    status: "queued" | "processing" | "completed" | "partially_failed" | "failed";
    errorLog: Array<{ recipientName?: string | undefined; email?: string | undefined; error: string; timestamp: string }>;
}

export class CertificateQueueService {
    // In-memory active job states for low-latency progress tracking
    private static activeJobs = new Map<string, InFlightJobState>();

    // Rate limiter: clubId -> timestamps of recent submissions
    private static rateLimits = new Map<string, number[]>();

    // Bounded concurrency pool: maximum concurrent certificate PDF renders
    private static MAX_CONCURRENCY = 4;
    private static currentConcurrency = 0;
    private static renderQueue: Array<() => Promise<void>> = [];

    /**
     * Enforces rate limiting per club (max 10 batch creations per minute)
     */
    static checkRateLimit(clubId: string, maxPerMinute: number = 10): boolean {
        const now = Date.now();
        const windowMs = 60 * 1000;
        const timestamps = this.rateLimits.get(clubId) || [];
        const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

        if (recentTimestamps.length >= maxPerMinute) {
            return false;
        }

        recentTimestamps.push(now);
        this.rateLimits.set(clubId, recentTimestamps);
        return true;
    }

    /**
     * Checks if a job with the specified idempotency key is already active or recently completed
     */
    static async findByIdempotencyKey(clubId: string, idempotencyKey: string): Promise<string | null> {
        if (!idempotencyKey) return null;

        const res = await query(
            `SELECT id FROM certificate_batches
             WHERE club_id = $1 AND idempotency_key = $2 AND created_at > NOW() - INTERVAL '5 minutes'
             LIMIT 1;`,
            [clubId, idempotencyKey]
        );

        return res.rows[0]?.id || null;
    }

    /**
     * Enqueues a task onto the bounded concurrency worker pool
     */
    private static async runWithConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const execute = async () => {
                this.currentConcurrency++;
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                } finally {
                    this.currentConcurrency--;
                    if (this.renderQueue.length > 0) {
                        const next = this.renderQueue.shift();
                        if (next) next();
                    }
                }
            };

            if (this.currentConcurrency < this.MAX_CONCURRENCY) {
                execute();
            } else {
                this.renderQueue.push(execute);
            }
        });
    }

    /**
     * Helper to mask email for public/recipient safety
     */
    private static maskEmail(email?: string): string {
        if (!email || !email.includes("@")) return "";
        const parts = email.split("@");
        const local = parts[0] || "";
        const domain = parts[1] || "";
        if (local.length <= 2) return `${local[0] || "*"}*@${domain}`;
        return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
    }

    /**
     * Enqueues a batch for asynchronous processing
     */
    static async enqueueBatch(params: EnqueueBatchJobParams): Promise<void> {
        const { batchId, clubId, title, willIssueTeams, finalTeamSnapshots, willIssueIndividuals, eligibleUsers } = params;

        const totalRecipients =
            (willIssueTeams ? finalTeamSnapshots.length : 0) + (willIssueIndividuals ? eligibleUsers.length : 0);

        // Initialize in-memory tracker
        const jobState: InFlightJobState = {
            batchId,
            clubId,
            title,
            totalRecipients,
            processedCount: 0,
            successfulCount: 0,
            failedCount: 0,
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
            status: "queued",
            errorLog: [],
        };

        this.activeJobs.set(batchId, jobState);

        // Spawn background execution asynchronously without blocking HTTP caller
        setImmediate(async () => {
            try {
                await this.processBatchJob(params, jobState);
            } catch (err: any) {
                console.error(`[CertificateQueueService] Fatal error processing batch ${batchId}:`, err);
                jobState.status = "failed";
                jobState.errorLog.push({
                    error: err.message || "Unknown worker failure",
                    timestamp: new Date().toISOString(),
                });
                await query(
                    `UPDATE certificate_batches SET
                        status = 'failed',
                        error_log = $1::jsonb,
                        updated_at = NOW()
                     WHERE id = $2;`,
                    [JSON.stringify(jobState.errorLog), batchId]
                );
            }
        });
    }

    /**
     * Core worker that processes team and individual certificate jobs with bounded concurrency
     */
    private static async processBatchJob(params: EnqueueBatchJobParams, jobState: InFlightJobState): Promise<void> {
        const {
            batchId,
            clubId,
            staffUserId,
            title,
            certificateType,
            issuanceSource,
            eventId,
            awardPosition,
            description,
            signerName,
            signerRole,
            issueDate,
            metadata,
            design,
            resolvedTemplateId,
            templateVersion,
            club,
            eventRecord,
            willIssueTeams,
            willIssueIndividuals,
            finalTeamSnapshots,
            eligibleUsers,
            recipientsOverrideMap = [],
        } = params;

        jobState.status = "processing";
        await query(`UPDATE certificate_batches SET status = 'processing', updated_at = NOW() WHERE id = $1;`, [batchId]);

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

        const targetIssueDate = issueDate ? new Date(issueDate) : new Date();
        const formattedIssueDate = targetIssueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        const issuedCertificates: any[] = [];
        let teamCertificatesCount = 0;
        let individualCertificatesCount = 0;

        // 1. Process Team Certificates
        if (willIssueTeams) {
            for (const tm of finalTeamSnapshots) {
                try {
                    const teamRandomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
                    const teamCredentialCode = `ORB-${clubSlugPrefix}-${currentYear}-${teamRandomHex}`;

                    const teamMembersSnapshot = (tm.members || []).map((m: any) => ({
                        userId: m.userId || null,
                        isExternal: Boolean(m.isExternal),
                        name: m.name || m.customName || "Team Member",
                        username: m.username || "",
                        email: this.maskEmail(m.email),
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
                            title,
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

                    // Bounded PDF rendering
                    const renderRes = await this.runWithConcurrencyLimit(async () => {
                        return await CertificatePdfService.renderCertificatePdf(design, teamSnapshot);
                    });

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
                        supportingMetadata: metadata || {},
                    });

                    const insertRes = await query(
                        `INSERT INTO club_certificates (
                            club_id, user_id, event_id, template_id, template_version,
                            batch_id, team_id, title, certificate_type, recipient_name,
                            recipient_email, description, credential_code, signer_name,
                            signer_role, issued_by_user_id, issue_date, design_snapshot,
                            recipient_snapshot, sha256_hash, metadata, claim_status
                        ) VALUES (
                            $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9,
                            NULL, $10, $11, $12, $13, $14, $15, $16::jsonb,
                            $17::jsonb, $18, $19::jsonb, 'claimed'
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
                            title,
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
                            renderRes.sha256Hash,
                            teamCertMetadataJson,
                        ]
                    );

                    const teamCert = insertRes.rows[0];
                    issuedCertificates.push(teamCert);
                    teamCertificatesCount++;
                    jobState.successfulCount++;

                    // In-app notifications to active team members
                    for (const member of tm.members || []) {
                        if (member.userId) {
                            const teamNotifTitle = `🎓 Your team received a certificate!`;
                            const teamNotifBody = `${club.name} has awarded your team "${tm.teamName}" the "${title}" certificate${
                                eventRecord ? ` for ${eventRecord.title}` : ""
                            }. Tap to view.`;

                            const teamNotifMeta = JSON.stringify({
                                type: "club_certificate",
                                certificateId: teamCert.id,
                                credentialCode: teamCert.credential_code,
                                clubId: club.id,
                                clubName: club.name,
                                clubSlug: club.slug,
                                eventId: eventId || null,
                                eventTitle: eventRecord?.title || null,
                                certificateType,
                                title,
                                issueDate: teamCert.issue_date,
                                isSpoiler: true,
                                isRevealed: false,
                                isTeam: true,
                                teamId: tm.teamId,
                                teamName: tm.teamName,
                            });

                            await query(
                                `INSERT INTO user_notifications (
                                    user_id, recipient_id, username, title, body,
                                    type, notification_type, metadata, idempotency_key, is_read, created_at
                                ) VALUES (
                                    $1, $1, $2, $3, $4,
                                    'club_certificate', 'team_certificate_awarded', $5::jsonb, $6, false, NOW()
                                )
                                ON CONFLICT (idempotency_key) DO UPDATE SET
                                    title = EXCLUDED.title,
                                    body = EXCLUDED.body,
                                    metadata = EXCLUDED.metadata;`,
                                [
                                    member.userId,
                                    member.username || member.name,
                                    teamNotifTitle,
                                    teamNotifBody,
                                    teamNotifMeta,
                                    `team-cert-${teamCert.id}-${member.userId}`,
                                ]
                            );
                        }
                    }
                } catch (teamErr: any) {
                    console.error(`Error issuing team certificate for ${tm.teamName}:`, teamErr);
                    jobState.failedCount++;
                    jobState.errorLog.push({
                        recipientName: tm.teamName,
                        error: teamErr.message || "Team PDF generation or insert failed",
                        timestamp: new Date().toISOString(),
                    });
                } finally {
                    jobState.processedCount++;
                    jobState.lastUpdateTime = Date.now();
                }
            }
        }

        // 2. Process Individual Certificates with Bounded Concurrency
        if (willIssueIndividuals) {
            for (const user of eligibleUsers) {
                try {
                    const customOverrides = recipientsOverrideMap.find((r) => r.userId === user.id);
                    const recipientDisplayName = customOverrides?.customName?.trim() || user.name;
                    const recipientPosition = customOverrides?.customPosition?.trim() || user.customPosition || awardPosition || "";

                    const userTeamId = user.teamId;
                    const userTeamName = user.teamName;
                    const userTeamRole = user.customRole || customOverrides?.customRole;
                    const userTeamSnapshot = user.teamMembershipSnapshot;

                    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
                    const credentialCode = `ORB-${clubSlugPrefix}-${currentYear}-${randomHex}`;

                    const isExternal = Boolean(user.isExternal);
                    const claimToken = isExternal ? crypto.randomBytes(24).toString("hex") : null;
                    const claimUrl = isExternal ? `https://orbix.dev/verify/certificate/claim/${claimToken}` : null;

                    const snapshot: DynamicDataSnapshot = {
                        recipient: {
                            id: user.id || "external",
                            name: recipientDisplayName,
                            username: user.username || "participant",
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
                            title,
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

                    // Run bounded PDF render
                    const renderRes = await this.runWithConcurrencyLimit(async () => {
                        return await CertificatePdfService.renderCertificatePdf(design, snapshot);
                    });

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
                        supportingMetadata: metadata || {},
                    });

                    let certInsertRes: any;
                    if (isExternal) {
                        certInsertRes = await query(
                            `INSERT INTO club_certificates (
                                club_id, user_id, event_id, template_id, template_version,
                                batch_id, team_id, title, certificate_type, recipient_name,
                                recipient_email, description, credential_code, signer_name,
                                signer_role, issued_by_user_id, issue_date, design_snapshot,
                                recipient_snapshot, sha256_hash, metadata, claim_token, claim_status, claim_expires_at
                            ) VALUES (
                                $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9,
                                $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
                                $18::jsonb, $19, $20::jsonb, $21, 'pending_claim', NOW() + INTERVAL '60 days'
                            ) RETURNING id, credential_code, title, certificate_type, issue_date;`,
                            [
                                club.id,
                                eventId || null,
                                resolvedTemplateId,
                                templateVersion,
                                batchId,
                                userTeamId || null,
                                title,
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
                                renderRes.sha256Hash,
                                certMetadataJson,
                                claimToken,
                            ]
                        );
                    } else {
                        certInsertRes = await query(
                            `INSERT INTO club_certificates (
                                club_id, user_id, event_id, template_id, template_version,
                                batch_id, team_id, title, certificate_type, recipient_name,
                                recipient_email, description, credential_code, signer_name,
                                signer_role, issued_by_user_id, issue_date, design_snapshot,
                                recipient_snapshot, sha256_hash, metadata, claim_status
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
                                $19::jsonb, $20, $21::jsonb, 'claimed'
                            )
                            ON CONFLICT (club_id, user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title)
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
                                title,
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
                                renderRes.sha256Hash,
                                certMetadataJson,
                            ]
                        );
                    }

                    const cert = certInsertRes.rows[0];
                    issuedCertificates.push(cert);
                    individualCertificatesCount++;
                    jobState.successfulCount++;

                    // Create in-app notification with spoiler preview
                    if (user.id && !isExternal) {
                        const notifTitle = `🎓 You've received a certificate!`;
                        const notifBody = `${club.name} has awarded you the "${title}" certificate${
                            eventRecord ? ` for ${eventRecord.title}` : ""
                        }. Tap to reveal your achievement.`;

                        const notifMetadata = JSON.stringify({
                            type: "club_certificate",
                            certificateId: cert.id,
                            credentialCode: cert.credential_code,
                            clubId: club.id,
                            clubName: club.name,
                            clubSlug: club.slug,
                            eventId: eventId || null,
                            eventTitle: eventRecord?.title || null,
                            certificateType,
                            title,
                            issueDate: cert.issue_date,
                            isSpoiler: true,
                            isRevealed: false,
                        });

                        await query(
                            `INSERT INTO user_notifications (
                                user_id, recipient_id, username, title, body,
                                type, notification_type, metadata, idempotency_key, is_read, created_at
                            ) VALUES (
                                $1, $1, $2, $3, $4,
                                'club_certificate', 'certificate_awarded', $5::jsonb, $6, false, NOW()
                            )
                            ON CONFLICT (idempotency_key) DO UPDATE SET
                                title = EXCLUDED.title,
                                body = EXCLUDED.body,
                                metadata = EXCLUDED.metadata;`,
                            [
                                user.id,
                                user.username,
                                notifTitle,
                                notifBody,
                                notifMetadata,
                                `cert-${cert.id}`,
                            ]
                        );
                    }
                } catch (userErr: any) {
                    console.error(`Error issuing certificate for recipient ${user.name || user.email}:`, userErr);
                    jobState.failedCount++;
                    jobState.errorLog.push({
                        recipientName: user.name,
                        email: user.email,
                        error: userErr.message || "PDF generation or insert failed",
                        timestamp: new Date().toISOString(),
                    });
                } finally {
                    jobState.processedCount++;
                    jobState.lastUpdateTime = Date.now();

                    // Periodically sync progress to DB every 5 items
                    if (jobState.processedCount % 5 === 0) {
                        await query(
                            `UPDATE certificate_batches SET
                                successful_count = $1,
                                failed_count = $2,
                                updated_at = NOW()
                             WHERE id = $3;`,
                            [jobState.successfulCount, jobState.failedCount, batchId]
                        );
                    }
                }
            }
        }

        // Determine final batch status
        let finalStatus: "completed" | "partially_failed" | "failed" = "completed";
        if (jobState.failedCount > 0 && jobState.successfulCount > 0) {
            finalStatus = "partially_failed";
        } else if (jobState.failedCount > 0 && jobState.successfulCount === 0) {
            finalStatus = "failed";
        }

        jobState.status = finalStatus;

        // Persist final batch state
        await query(
            `UPDATE certificate_batches SET
                status = $1,
                successful_count = $2,
                failed_count = $3,
                error_log = $4::jsonb,
                updated_at = NOW()
             WHERE id = $5;`,
            [
                finalStatus,
                jobState.successfulCount,
                jobState.failedCount,
                JSON.stringify(jobState.errorLog),
                batchId,
            ]
        );

        // Audit log
        await query(
            `INSERT INTO certificate_audit_logs (
                club_id, actor_user_id, action, entity_type, entity_id, metadata
            ) VALUES ($1, $2, 'certificate_batch_async_completed', 'certificate_batch', $3, $4::jsonb);`,
            [
                club.id,
                staffUserId,
                batchId,
                JSON.stringify({
                    title,
                    finalStatus,
                    totalRecipients: jobState.totalRecipients,
                    successfulCount: jobState.successfulCount,
                    failedCount: jobState.failedCount,
                    teamCertificatesCount,
                    individualCertificatesCount,
                }),
            ]
        );

        // Credibility Event
        if (jobState.successfulCount > 0) {
            ClubCredibilityService.recordCredibilityEvent({
                clubId: club.id,
                eventId: eventId ? String(eventId) : undefined,
                sourceAction: "certificate_issued",
                reasonCode: "verified_credentials_awarded",
                outcomeQuality: 92,
                weightInputs: {
                    baseWeight: 0.85,
                    scope: "CAMPUS",
                    verifiedAttendees: jobState.successfulCount,
                    isNegativeOutcome: false,
                },
                idempotencyKey: `cred-cert-batch-${batchId}`,
            }).catch((credErr) => console.error("Credibility error:", credErr));
        }
    }

    /**
     * Retrieves real-time batch progress (merging in-memory with DB state)
     */
    static async getBatchProgress(batchId: string, clubId: string): Promise<BatchProgressInfo | null> {
        // Query current DB record
        const res = await query(
            `SELECT
                id,
                club_id AS "clubId",
                title,
                status,
                total_recipients AS "totalRecipients",
                successful_count AS "successfulCount",
                failed_count AS "failedCount",
                error_log AS "errorLog",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM certificate_batches
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [batchId, clubId]
        );

        const row = res.rows[0];
        if (!row) return null;

        const memoryState = this.activeJobs.get(batchId);

        const totalRecipients = row.totalRecipients || 1;
        const successfulCount = memoryState ? memoryState.successfulCount : row.successfulCount;
        const failedCount = memoryState ? memoryState.failedCount : row.failedCount;
        const processedCount = memoryState ? memoryState.processedCount : successfulCount + failedCount;
        const status = memoryState ? memoryState.status : row.status;
        const errorLog = memoryState && memoryState.errorLog.length > 0 ? memoryState.errorLog : (row.errorLog || []);

        const progressPercentage = Math.min(
            100,
            Math.round((processedCount / Math.max(1, totalRecipients)) * 100)
        );

        // Calculate throughput
        let throughput = 0;
        if (memoryState && memoryState.startTime) {
            const elapsedSec = (Date.now() - memoryState.startTime) / 1000;
            if (elapsedSec > 0.5) {
                throughput = Math.round((processedCount / elapsedSec) * 10) / 10;
            }
        }

        const isRecoverable = (status === "partially_failed" || status === "failed" || failedCount > 0);

        return {
            id: row.id,
            clubId: row.clubId,
            title: row.title,
            status,
            totalRecipients,
            processedCount,
            successfulCount,
            failedCount,
            progressPercentage,
            currentThroughput: throughput,
            errorLog,
            isRecoverable,
            canRetry: isRecoverable,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    /**
     * Retries failed items for a partially failed or failed batch without duplicating successful ones
     */
    static async retryFailedBatch(batchId: string, clubId: string, staffUserId: string): Promise<{ success: boolean; retriedCount: number }> {
        const batchRes = await query(
            `SELECT
                id, club_id, title, status, total_recipients, successful_count, failed_count,
                error_log, batch_payload
             FROM certificate_batches
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [batchId, clubId]
        );

        const batch = batchRes.rows[0];
        if (!batch) throw new Error("Batch not found.");

        const payload = batch.batch_payload;
        if (!payload || !payload.clubId) {
            throw new Error("Batch configuration payload missing. Full re-issuance is required.");
        }

        // Query existing successfully issued credential recipient identifiers for this batch
        const existingCertsRes = await query(
            `SELECT user_id, recipient_email, team_id
             FROM club_certificates
             WHERE batch_id = $1;`,
            [batchId]
        );

        const alreadyIssuedUserIds = new Set(existingCertsRes.rows.map((c) => c.user_id).filter(Boolean));
        const alreadyIssuedEmails = new Set(existingCertsRes.rows.map((c) => c.recipient_email?.toLowerCase()).filter(Boolean));
        const alreadyIssuedTeamIds = new Set(existingCertsRes.rows.map((c) => c.team_id).filter(Boolean));

        // Filter out recipients and teams that already succeeded
        const remainingTeams = (payload.finalTeamSnapshots || []).filter(
            (t: any) => !alreadyIssuedTeamIds.has(t.teamId)
        );

        const remainingIndividuals = (payload.eligibleUsers || []).filter((u: any) => {
            if (u.id && alreadyIssuedUserIds.has(u.id)) return false;
            if (u.email && alreadyIssuedEmails.has(u.email.toLowerCase())) return false;
            return true;
        });

        const retriedCount = remainingTeams.length + remainingIndividuals.length;
        if (retriedCount === 0) {
            // All already succeeded! Mark batch completed
            await query(
                `UPDATE certificate_batches SET
                    status = 'completed',
                    failed_count = 0,
                    updated_at = NOW()
                 WHERE id = $1;`,
                [batchId]
            );
            return { success: true, retriedCount: 0 };
        }

        // Update batch state to queued
        await query(
            `UPDATE certificate_batches SET
                status = 'queued',
                error_log = '[]'::jsonb,
                updated_at = NOW()
             WHERE id = $1;`,
            [batchId]
        );

        // Enqueue the retry job
        const retryJobParams: EnqueueBatchJobParams = {
            ...payload,
            batchId,
            staffUserId,
            finalTeamSnapshots: remainingTeams,
            eligibleUsers: remainingIndividuals,
            willIssueTeams: remainingTeams.length > 0,
            willIssueIndividuals: remainingIndividuals.length > 0,
        };

        const jobState: InFlightJobState = {
            batchId,
            clubId,
            title: payload.title,
            totalRecipients: batch.total_recipients,
            processedCount: batch.successful_count,
            successfulCount: batch.successful_count,
            failedCount: 0,
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
            status: "queued",
            errorLog: [],
        };

        this.activeJobs.set(batchId, jobState);

        setImmediate(async () => {
            try {
                await this.processBatchJob(retryJobParams, jobState);
            } catch (err: any) {
                console.error(`Fatal error retrying batch ${batchId}:`, err);
                await query(
                    `UPDATE certificate_batches SET status = 'failed', updated_at = NOW() WHERE id = $1;`,
                    [batchId]
                );
            }
        });

        return { success: true, retriedCount };
    }
}
