import crypto from "crypto";
import { query } from "../../database/client.js";
import { CertificatePdfService } from "./certificatePdfService.js";
import { ClubCredibilityService } from "./clubCredibilityService.js";
import { CertificateNotificationService, type UserAwardsEntry } from "./certificateNotificationService.js";
import type { CertificateDesign, DynamicDataSnapshot } from "../../types/certificateStudio.js";

export interface BatchProgressInfo {
    id: string;
    clubId: string;
    title: string;
    status: "draft" | "validating" | "queued" | "processing" | "completed" | "partially_failed" | "partially_completed" | "failed" | "cancelled";
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
    canCancel: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CertificateQueueMetrics {
    generationThroughput: number; // certs/sec across recent window
    averageGenerationTimeMs: number; // average duration in ms to render & persist 1 cert
    batchCompletionTimeMs: number; // average duration in ms of completed batches
    queueBacklog: number; // number of jobs awaiting execution in concurrency pool
    activeBatchesCount: number; // batches currently processing
    totalProcessedCount: number;
    totalSuccessfulCount: number;
    failedRenderJobs: number;
    storageErrors: number;
    notificationDeliveryFailures: number;
    maxConcurrency: number;
    currentConcurrency: number;
}

/**
 * Exponential backoff with jitter for resilient async processing (Phase 19)
 */
export async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        factor?: number;
        onRetry?: (error: any, attempt: number) => void;
    } = {}
): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 100;
    const maxDelayMs = options.maxDelayMs ?? 2000;
    const factor = options.factor ?? 2;

    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;
            if (attempt === maxRetries) break;
            const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, attempt - 1)) + Math.floor(Math.random() * 25);
            if (options.onRetry) {
                options.onRetry(err, attempt);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
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
    status: "draft" | "validating" | "queued" | "processing" | "completed" | "partially_failed" | "partially_completed" | "failed" | "cancelled";
    isCancelled?: boolean;
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

    // Telemetry and Queue Monitoring Metrics (Phase 19)
    private static totalProcessedCount = 0;
    private static totalSuccessfulCount = 0;
    private static totalRenderTimeMs = 0;
    private static renderTimeSamplesCount = 0;
    private static totalBatchCompletionTimeMs = 0;
    private static completedBatchesCount = 0;
    private static failedRenderJobsCount = 0;
    private static storageErrorsCount = 0;
    private static notificationFailuresCount = 0;

    // Graceful Shutdown state (Phase 19)
    private static isShuttingDown = false;
    private static isShutdownHookRegistered = false;

    /**
     * Registers process signal listeners (SIGTERM, SIGINT) for graceful worker shutdown and batch checkpointing
     */
    static registerShutdownHandlers(): void {
        if (this.isShutdownHookRegistered) return;
        this.isShutdownHookRegistered = true;

        const handleSignal = async (signal: string) => {
            console.log(`[CertificateQueueService] Graceful shutdown triggered by ${signal}...`);
            await this.handleGracefulShutdown();
        };

        process.once("SIGTERM", () => handleSignal("SIGTERM"));
        process.once("SIGINT", () => handleSignal("SIGINT"));
    }

    /**
     * Checkpoints in-flight active jobs safely back to the database on worker termination
     */
    static async handleGracefulShutdown(): Promise<void> {
        this.isShuttingDown = true;
        for (const [batchId, job] of this.activeJobs.entries()) {
            if (job.status === "processing" || job.status === "queued") {
                try {
                    await query(
                        `UPDATE certificate_batches SET
                            status = 'queued',
                            successful_count = $1,
                            failed_count = $2,
                            updated_at = NOW()
                         WHERE id = $3;`,
                        [job.successfulCount, job.failedCount, batchId]
                    );
                } catch (err) {
                    console.error(`Error saving checkpoint for batch ${batchId}:`, err);
                }
            }
        }
    }

    /**
     * Retrieves aggregated queue telemetry and performance metrics (Phase 19)
     */
    static getQueueMetrics(clubId?: string): CertificateQueueMetrics {
        let activeBatchesCount = 0;
        let recentProcessed = 0;
        let recentTimeElapsedSec = 0;

        for (const job of this.activeJobs.values()) {
            if (!clubId || job.clubId === clubId) {
                activeBatchesCount++;
                recentProcessed += job.processedCount;
                const elapsed = (Date.now() - job.startTime) / 1000;
                if (elapsed > 0.5) {
                    recentTimeElapsedSec += elapsed;
                }
            }
        }

        const avgGenTimeMs = this.renderTimeSamplesCount > 0
            ? Math.round(this.totalRenderTimeMs / this.renderTimeSamplesCount)
            : 0;

        const avgBatchTimeMs = this.completedBatchesCount > 0
            ? Math.round(this.totalBatchCompletionTimeMs / this.completedBatchesCount)
            : 0;

        const throughput = recentTimeElapsedSec > 0
            ? Math.round((recentProcessed / recentTimeElapsedSec) * 10) / 10
            : (avgGenTimeMs > 0 ? Math.round((1000 / avgGenTimeMs) * this.MAX_CONCURRENCY * 10) / 10 : 0);

        return {
            generationThroughput: throughput,
            averageGenerationTimeMs: avgGenTimeMs,
            batchCompletionTimeMs: avgBatchTimeMs,
            queueBacklog: this.renderQueue.length,
            activeBatchesCount,
            totalProcessedCount: this.totalProcessedCount,
            totalSuccessfulCount: this.totalSuccessfulCount,
            failedRenderJobs: this.failedRenderJobsCount,
            storageErrors: this.storageErrorsCount,
            notificationDeliveryFailures: this.notificationFailuresCount,
            maxConcurrency: this.MAX_CONCURRENCY,
            currentConcurrency: this.currentConcurrency,
        };
    }

    /**
     * Resets telemetry metrics (used by test suites)
     */
    static resetMetricsForTest(): void {
        this.totalProcessedCount = 0;
        this.totalSuccessfulCount = 0;
        this.totalRenderTimeMs = 0;
        this.renderTimeSamplesCount = 0;
        this.totalBatchCompletionTimeMs = 0;
        this.completedBatchesCount = 0;
        this.failedRenderJobsCount = 0;
        this.storageErrorsCount = 0;
        this.notificationFailuresCount = 0;
        this.isShuttingDown = false;
        this.rateLimits.clear();
    }

    /**
     * Resets rate limits for testing
     */
    static resetRateLimitsForTest(): void {
        this.rateLimits.clear();
    }

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
        const { batchId, clubId, title, willIssueTeams, willIssueIndividuals } = params;

        // Phase 19: Recipient deduplication across selection sources
        const dedupedUsers: any[] = [];
        const seenUserIds = new Set<string>();
        const seenEmails = new Set<string>();

        for (const user of params.eligibleUsers || []) {
            if (user.id) {
                if (seenUserIds.has(user.id)) continue;
                seenUserIds.add(user.id);
            }
            if (user.email) {
                const normEmail = user.email.toLowerCase().trim();
                if (seenEmails.has(normEmail)) continue;
                seenEmails.add(normEmail);
            }
            dedupedUsers.push(user);
        }

        const dedupedTeams: any[] = [];
        const seenTeamIds = new Set<string>();
        for (const tm of params.finalTeamSnapshots || []) {
            if (tm.teamId) {
                if (seenTeamIds.has(tm.teamId)) continue;
                seenTeamIds.add(tm.teamId);
            }
            dedupedTeams.push(tm);
        }

        params.eligibleUsers = dedupedUsers;
        params.finalTeamSnapshots = dedupedTeams;

        const totalRecipients =
            (willIssueTeams ? dedupedTeams.length : 0) + (willIssueIndividuals ? dedupedUsers.length : 0);

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

        // Phase 19: Pre-cache template background asset in memory for the batch
        const batchAssetCache = new Map<string, { buffer: Buffer; isPng: boolean }>();
        const bgImgUrl = design.background?.imageUrl || (design.background as any)?.assetUrl;
        if (bgImgUrl) {
            try {
                await CertificatePdfService.prefetchAsset(bgImgUrl, batchAssetCache);
            } catch (assetErr) {
                console.warn("[CertificateQueueService] Background asset prefetch warning:", assetErr);
            }
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

        const targetIssueDate = issueDate ? new Date(issueDate) : new Date();
        const formattedIssueDate = targetIssueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        const issuedCertificates: any[] = [];
        let teamCertificatesCount = 0;
        let individualCertificatesCount = 0;
        const userAwardsMap = new Map<string, UserAwardsEntry>();
        const CHUNK_SIZE = 25;

        // 1. Process Team Certificates (Chunked)
        if (willIssueTeams && finalTeamSnapshots.length > 0) {
            for (let chunkIdx = 0; chunkIdx < finalTeamSnapshots.length; chunkIdx += CHUNK_SIZE) {
                if (this.isShuttingDown) {
                    jobState.status = "queued";
                    await query(`UPDATE certificate_batches SET status = 'queued', updated_at = NOW() WHERE id = $1;`, [batchId]);
                    return;
                }
                if (jobState.isCancelled) {
                    jobState.status = "cancelled";
                    await query(`UPDATE certificate_batches SET status = 'cancelled', updated_at = NOW() WHERE id = $1;`, [batchId]);
                    return;
                }

                const teamChunk = finalTeamSnapshots.slice(chunkIdx, chunkIdx + CHUNK_SIZE);

                for (const tm of teamChunk) {
                    if (this.isShuttingDown) {
                        jobState.status = "queued";
                        await query(`UPDATE certificate_batches SET status = 'queued', updated_at = NOW() WHERE id = $1;`, [batchId]);
                        return;
                    }
                    if (jobState.isCancelled) {
                        jobState.status = "cancelled";
                        await query(`UPDATE certificate_batches SET status = 'cancelled', updated_at = NOW() WHERE id = $1;`, [batchId]);
                        return;
                    }
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

                        // Bounded PDF rendering with exponential backoff & telemetry (Phase 19)
                        const renderStart = Date.now();
                        let renderRes: any;
                        try {
                            renderRes = await this.runWithConcurrencyLimit(async () => {
                                return await retryWithBackoff(async () => {
                                    return await CertificatePdfService.renderCertificatePdf(
                                        design,
                                        teamSnapshot,
                                        "https://orbix.dev",
                                        { assetCache: batchAssetCache }
                                    );
                                }, { maxRetries: 3, baseDelayMs: 50 });
                            });
                            const renderDuration = Date.now() - renderStart;
                            this.totalRenderTimeMs += renderDuration;
                            this.renderTimeSamplesCount++;
                        } catch (renderErr) {
                            this.failedRenderJobsCount++;
                            throw renderErr;
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
                            supportingMetadata: metadata || {},
                        });

                        let insertRes: any;
                        try {
                            insertRes = await retryWithBackoff(async () => {
                                return await query(
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
                            }, { maxRetries: 3, baseDelayMs: 50 });
                        } catch (storageErr) {
                            this.storageErrorsCount++;
                            throw storageErr;
                        }

                        const teamCert = insertRes.rows[0];
                        issuedCertificates.push(teamCert);
                        teamCertificatesCount++;
                        jobState.successfulCount++;
                        this.totalSuccessfulCount++;

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
                                    title,
                                    certificate_type: certificateType,
                                    recipient_name: tm.teamName,
                                    issue_date: teamCert.issue_date,
                                    sha256_hash: renderRes.sha256Hash || undefined,
                                    isTeam: true,
                                    teamName: tm.teamName,
                                    awardPosition: awardPosition || undefined,
                                });
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
                        this.totalProcessedCount++;
                        jobState.lastUpdateTime = Date.now();
                    }
                }

                // Checkpoint to DB and yield to event loop for garbage collection
                await query(
                    `UPDATE certificate_batches SET
                        successful_count = $1,
                        failed_count = $2,
                        updated_at = NOW()
                     WHERE id = $3;`,
                    [jobState.successfulCount, jobState.failedCount, batchId]
                );
                await new Promise((resolve) => setImmediate(resolve));
            }
        }

        // 2. Process Individual Certificates with Bounded Concurrency (Chunked)
        if (willIssueIndividuals && eligibleUsers.length > 0) {
            for (let chunkIdx = 0; chunkIdx < eligibleUsers.length; chunkIdx += CHUNK_SIZE) {
                if (this.isShuttingDown) {
                    jobState.status = "queued";
                    await query(`UPDATE certificate_batches SET status = 'queued', updated_at = NOW() WHERE id = $1;`, [batchId]);
                    return;
                }
                if (jobState.isCancelled) {
                    jobState.status = "cancelled";
                    await query(`UPDATE certificate_batches SET status = 'cancelled', updated_at = NOW() WHERE id = $1;`, [batchId]);
                    return;
                }

                const userChunk = eligibleUsers.slice(chunkIdx, chunkIdx + CHUNK_SIZE);

                for (const user of userChunk) {
                    if (this.isShuttingDown) {
                        jobState.status = "queued";
                        await query(`UPDATE certificate_batches SET status = 'queued', updated_at = NOW() WHERE id = $1;`, [batchId]);
                        return;
                    }
                    if (jobState.isCancelled) {
                        jobState.status = "cancelled";
                        await query(`UPDATE certificate_batches SET status = 'cancelled', updated_at = NOW() WHERE id = $1;`, [batchId]);
                        return;
                    }
                    try {
                        const customOverrides = recipientsOverrideMap.find((r) => r.userId === user.id);
                        const recipientDisplayName = customOverrides?.customName?.trim() || customOverrides?.name?.trim() || user.name;
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

                        // Run bounded PDF render with exponential backoff & telemetry (Phase 19)
                        const renderStart = Date.now();
                        let renderRes: any;
                        try {
                            renderRes = await this.runWithConcurrencyLimit(async () => {
                                return await retryWithBackoff(async () => {
                                    return await CertificatePdfService.renderCertificatePdf(
                                        design,
                                        snapshot,
                                        "https://orbix.dev",
                                        { assetCache: batchAssetCache }
                                    );
                                }, { maxRetries: 3, baseDelayMs: 50 });
                            });
                            const renderDuration = Date.now() - renderStart;
                            this.totalRenderTimeMs += renderDuration;
                            this.renderTimeSamplesCount++;
                        } catch (renderErr) {
                            this.failedRenderJobsCount++;
                            throw renderErr;
                        }

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
                        try {
                            if (isExternal) {
                                certInsertRes = await retryWithBackoff(async () => {
                                    return await query(
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
                                }, { maxRetries: 3, baseDelayMs: 50 });
                            } else {
                                certInsertRes = await retryWithBackoff(async () => {
                                    return await query(
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
                                }, { maxRetries: 3, baseDelayMs: 50 });
                            }
                        } catch (storageErr) {
                            this.storageErrorsCount++;
                            throw storageErr;
                        }

                        const cert = certInsertRes.rows[0];
                        issuedCertificates.push(cert);
                        individualCertificatesCount++;
                        jobState.successfulCount++;
                        this.totalSuccessfulCount++;

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
                                title,
                                certificate_type: certificateType,
                                recipient_name: recipientDisplayName,
                                issue_date: cert.issue_date,
                                sha256_hash: renderRes.sha256Hash || undefined,
                                awardPosition: recipientPosition || undefined,
                            });
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
                        this.totalProcessedCount++;
                        jobState.lastUpdateTime = Date.now();
                    }
                }

                // Periodically sync progress to DB every chunk and yield event loop
                await query(
                    `UPDATE certificate_batches SET
                        successful_count = $1,
                        failed_count = $2,
                        updated_at = NOW()
                     WHERE id = $3;`,
                    [jobState.successfulCount, jobState.failedCount, batchId]
                );
                await new Promise((resolve) => setImmediate(resolve));
            }
        }

        // Phase 15 & 19: Resilient bulk notification grouping & dispatch with retry
        try {
            await retryWithBackoff(async () => {
                await CertificateNotificationService.dispatchCertificateNotifications({ query }, {
                    club,
                    eventRecord,
                    batchId,
                    userAwardsMap,
                });
            }, { maxRetries: 2, baseDelayMs: 100 });
        } catch (notifErr: any) {
            console.error(`[CertificateQueueService] Notification delivery failure for batch ${batchId}:`, notifErr);
            this.notificationFailuresCount++;
        }

        // Record batch completion telemetry (Phase 19)
        const batchDuration = Date.now() - jobState.startTime;
        this.totalBatchCompletionTimeMs += batchDuration;
        this.completedBatchesCount++;

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
                    durationMs: batchDuration,
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
        const canCancel = (status === "queued" || status === "processing" || status === "validating");

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
            canCancel,
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

    /**
     * Cancels an active or queued batch, preventing remaining unprocessed jobs from executing (Phase 14)
     */
    static async cancelBatch(
        batchId: string,
        clubId: string,
        staffUserId: string
    ): Promise<{ success: boolean; message: string; cancelledUnprocessedCount: number }> {
        // Enforce club ownership authorization before altering any in-memory or persisted state
        const batchRes = await query(
            `SELECT id, status, total_recipients, successful_count, failed_count
             FROM certificate_batches
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [batchId, clubId]
        );

        if (batchRes.rowCount === 0) {
            throw new Error("Batch not found.");
        }

        const memoryState = this.activeJobs.get(batchId);
        if (memoryState) {
            memoryState.isCancelled = true;
            memoryState.status = "cancelled";
        }

        const batch = batchRes.rows[0];
        if (batch.status === "completed" || batch.status === "cancelled") {
            return {
                success: false,
                message: `Batch is already ${batch.status}.`,
                cancelledUnprocessedCount: 0,
            };
        }

        const unprocessedCount = Math.max(
            0,
            batch.total_recipients - (batch.successful_count + batch.failed_count)
        );

        await query(
            `UPDATE certificate_batches SET
                status = 'cancelled',
                updated_at = NOW()
             WHERE id = $1;`,
            [batchId]
        );

        await query(
            `INSERT INTO certificate_audit_logs (
                club_id, actor_user_id, action, entity_type, entity_id, metadata
            ) VALUES ($1, $2, 'certificate_batch_cancelled', 'certificate_batch', $3, $4::jsonb);`,
            [
                clubId,
                staffUserId,
                batchId,
                JSON.stringify({
                    cancelledAt: new Date().toISOString(),
                    successfulCountBeforeCancel: batch.successful_count,
                    unprocessedCount,
                }),
            ]
        );

        return {
            success: true,
            message: `Batch cancelled successfully. ${unprocessedCount} unprocessed jobs aborted. ${batch.successful_count} already issued certificates remain valid.`,
            cancelledUnprocessedCount: unprocessedCount,
        };
    }

    /**
     * Retrieves structured error details for a batch (Phase 14)
     */
    static async getBatchErrors(
        batchId: string,
        clubId: string
    ): Promise<{
        batchId: string;
        title: string;
        status: string;
        totalRecipients: number;
        successfulCount: number;
        failedCount: number;
        errors: Array<{ recipientName?: string | undefined; email?: string | undefined; error: string; timestamp: string }>;
    }> {
        const res = await query(
            `SELECT id, title, status, total_recipients AS "totalRecipients", successful_count AS "successfulCount", failed_count AS "failedCount", error_log AS "errorLog"
             FROM certificate_batches
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [batchId, clubId]
        );

        if (res.rowCount === 0) throw new Error("Batch not found.");
        const row = res.rows[0];
        const memoryState = this.activeJobs.get(batchId);
        const errors = memoryState && memoryState.errorLog.length > 0 ? memoryState.errorLog : (row.errorLog || []);

        return {
            batchId: row.id,
            title: row.title,
            status: memoryState ? memoryState.status : row.status,
            totalRecipients: row.totalRecipients,
            successfulCount: memoryState ? memoryState.successfulCount : row.successfulCount,
            failedCount: memoryState ? memoryState.failedCount : row.failedCount,
            errors,
        };
    }

    /**
     * Generates a comprehensive generation report with CSV export for auditing (Phase 14)
     */
    static async generateBatchReport(
        batchId: string,
        clubId: string
    ): Promise<{
        summary: {
            batchId: string;
            title: string;
            status: string;
            totalRecipients: number;
            successfulCount: number;
            failedCount: number;
            issuedDate: string;
        };
        records: Array<{
            recipientName: string;
            recipientEmail: string;
            credentialCode?: string;
            sha256Hash?: string;
            status: "issued" | "failed";
            error?: string;
        }>;
        csvString: string;
    }> {
        const batchRes = await query(
            `SELECT id, title, status, total_recipients, successful_count, failed_count, error_log, created_at
             FROM certificate_batches
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [batchId, clubId]
        );

        if (batchRes.rowCount === 0) throw new Error("Batch not found.");
        const batch = batchRes.rows[0];

        const certsRes = await query(
            `SELECT recipient_name, recipient_email, credential_code, sha256_hash, is_revoked, status
             FROM club_certificates
             WHERE batch_id = $1
             ORDER BY recipient_name ASC;`,
            [batchId]
        );

        const records: Array<any> = [];

        // 1. Successfully issued certificates
        for (const c of certsRes.rows) {
            records.push({
                recipientName: c.recipient_name,
                recipientEmail: c.recipient_email || "",
                credentialCode: c.credential_code,
                sha256Hash: c.sha256_hash || "",
                status: "issued",
                error: "",
            });
        }

        // 2. Failed recipients from error_log
        const errorLog = Array.isArray(batch.error_log) ? batch.error_log : [];
        for (const err of errorLog) {
            records.push({
                recipientName: err.recipientName || "Unknown",
                recipientEmail: err.email || "",
                credentialCode: "",
                sha256Hash: "",
                status: "failed",
                error: err.error || "Generation error",
            });
        }

        // Formula injection protection for CSV generation
        const sanitizeCsv = (val: string) => {
            if (!val) return '""';
            let clean = String(val).replace(/"/g, '""');
            if (/^[=\+\-\@\t\r]/.test(clean)) {
                clean = `'` + clean;
            }
            return `"${clean}"`;
        };

        const csvHeaders = ["Recipient Name", "Email", "Status", "Credential Code", "SHA-256 Digest", "Error Details"];
        const csvRows = [csvHeaders.join(",")];

        for (const r of records) {
            csvRows.push([
                sanitizeCsv(r.recipientName),
                sanitizeCsv(r.recipientEmail),
                sanitizeCsv(r.status),
                sanitizeCsv(r.credentialCode || ""),
                sanitizeCsv(r.sha256Hash || ""),
                sanitizeCsv(r.error || ""),
            ].join(","));
        }

        return {
            summary: {
                batchId: batch.id,
                title: batch.title,
                status: batch.status,
                totalRecipients: batch.total_recipients,
                successfulCount: batch.successful_count,
                failedCount: batch.failed_count,
                issuedDate: batch.created_at,
            },
            records,
            csvString: csvRows.join("\n"),
        };
    }

    /**
     * Scans and resumes stalled batches stuck in 'processing' or 'queued' after worker/server restarts (Phase 14)
     */
    static async resumeWorkerProcessing(
        clubId?: string
    ): Promise<{ resumedCount: number; batchIds: string[] }> {
        const whereClause = clubId
            ? `WHERE club_id = $1 AND status IN ('processing', 'queued') AND updated_at < NOW() - INTERVAL '5 minutes'`
            : `WHERE status IN ('processing', 'queued') AND updated_at < NOW() - INTERVAL '5 minutes'`;
        const params = clubId ? [clubId] : [];

        const stalledRes = await query(
            `SELECT id, club_id, title, status, total_recipients, successful_count, failed_count
             FROM certificate_batches
             ${whereClause}
             LIMIT 20;`,
            params
        );

        const resumedBatchIds: string[] = [];

        for (const b of stalledRes.rows) {
            try {
                await this.retryFailedBatch(b.id, b.club_id, "system-worker-recovery");
                resumedBatchIds.push(b.id);
            } catch (resumeErr) {
                console.warn(`[CertificateQueueService] Auto-resume failed for batch ${b.id}:`, resumeErr);
            }
        }

        return {
            resumedCount: resumedBatchIds.length,
            batchIds: resumedBatchIds,
        };
    }
}
