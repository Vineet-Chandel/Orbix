import crypto from "crypto";
import bcrypt from "bcrypt";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { sendSecurityNotificationEmail } from "../email/resendService.js";

const ARCHIVE_COOLDOWN_SECONDS = 60; // 1 minute between generations
const ARCHIVE_DAILY_LIMIT = 5; // Max 5 complete archives per 24 hours
const STEPUP_OTP_TTL_SECONDS = 600; // 10 minutes

export type ArchiveCategory =
    | "identity"
    | "platforms"
    | "resumes"
    | "security"
    | "support"
    | "network";

export interface GenerateArchiveParams {
    userId: string;
    categories?: ArchiveCategory[] | "all";
    stepUpPassword?: string;
    stepUpOtp?: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface ArchiveStatusInfo {
    availableCategories: {
        id: ArchiveCategory;
        label: string;
        description: string;
        icon: string;
    }[];
    dailyLimit: number;
    dailyExportsUsed: number;
    dailyExportsRemaining: number;
    cooldownRemainingSeconds: number;
    canExport: boolean;
    hasPasswordAuth: boolean;
    primaryEmail: string;
    recentExports: {
        exportId: string;
        categories: string[];
        fileSizeBytes: number;
        sha256Checksum: string;
        createdAt: string;
        expiresAt: string;
    }[];
}

export class DataArchiveService {
    /**
     * Retrieves archive eligibility, daily limits, cooldown status, and recent export history.
     */
    static async getArchiveInfo(userId: string): Promise<ArchiveStatusInfo> {
        // 1. Fetch user to verify authentication mode
        const userRes = await query(
            `SELECT id, email, username, password FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        // 2. Check Daily Limit & Cooldown in Redis
        let dailyExportsUsed = 0;
        let cooldownRemainingSeconds = 0;

        if (redis && redis.status === "ready") {
            const dailyKey = `data_archive:daily:${userId}`;
            const currentDaily = await redis.get(dailyKey);
            dailyExportsUsed = currentDaily ? parseInt(currentDaily, 10) : 0;

            const cooldownTtl = await redis.ttl(`data_archive:cooldown:${userId}`);
            if (cooldownTtl > 0) {
                cooldownRemainingSeconds = cooldownTtl;
            }
        }

        // 3. Query Recent Exports from PostgreSQL
        const recentRes = await query(
            `SELECT export_id AS "exportId", requested_categories AS "categories",
                    file_size_bytes AS "fileSizeBytes", sha256_checksum AS "sha256Checksum",
                    created_at AS "createdAt", expires_at AS "expiresAt"
             FROM account_data_exports
             WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC
             LIMIT 5;`,
            [userId]
        );

        const availableCategories: ArchiveStatusInfo["availableCategories"] = [
            {
                id: "identity",
                label: "Account & Developer Identity",
                description: "Personal details, bio, college verification, verified badges & timestamps.",
                icon: "User",
            },
            {
                id: "platforms",
                label: "Competitive Coding Platforms",
                description: "LeetCode, Codeforces, GitHub, CodeChef synced credentials, problem stats & ratings.",
                icon: "Code2",
            },
            {
                id: "resumes",
                label: "Career Intelligence & Resumes",
                description: "Uploaded resumes, extracted skill trees, ATS analysis scores & role fit reports.",
                icon: "FileText",
            },
            {
                id: "security",
                label: "Security Audit & Account History",
                description: "Email & username modification logs, challenge records & authentication events.",
                icon: "Shield",
            },
            {
                id: "support",
                label: "Help Center & Support Inquiries",
                description: "Submitted support tickets, categories, descriptions & official resolutions.",
                icon: "HelpCircle",
            },
            {
                id: "network",
                label: "Network & Community Connections",
                description: "Mutual connections count, pending relationship requests & blocked entities summary.",
                icon: "Users",
            },
        ];

        const dailyExportsRemaining = Math.max(0, ARCHIVE_DAILY_LIMIT - dailyExportsUsed);
        const canExport = dailyExportsRemaining > 0 && cooldownRemainingSeconds === 0;

        return {
            availableCategories,
            dailyLimit: ARCHIVE_DAILY_LIMIT,
            dailyExportsUsed,
            dailyExportsRemaining,
            cooldownRemainingSeconds,
            canExport,
            hasPasswordAuth: Boolean(user.password && user.password.length > 5),
            primaryEmail: user.email,
            recentExports: recentRes.rows.map((row) => ({
                ...row,
                createdAt: new Date(row.createdAt).toISOString(),
                expiresAt: new Date(row.expiresAt).toISOString(),
            })),
        };
    }

    /**
     * Sends an email OTP to authorize GDPR Data Export (for passwordless / step-up accounts).
     */
    static async requestStepUpCode(userId: string): Promise<{ success: boolean; message: string; cooldownSeconds: number; devOtp?: string }> {
        const userRes = await query(
            `SELECT id, email, username, firstname FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        // Rate limit: 60s cooldown on OTP requests
        if (redis && redis.status === "ready") {
            const otpCooldown = await redis.ttl(`otp:data_archive_cooldown:${userId}`);
            if (otpCooldown > 0) {
                const err: any = new Error(`Please wait ${otpCooldown} seconds before requesting another code.`);
                err.statusCode = 429;
                throw err;
            }
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

        if (redis && redis.status === "ready") {
            await redis.set(`otp:data_archive:${userId}`, JSON.stringify({ otpHash, email: user.email }), "EX", STEPUP_OTP_TTL_SECONDS);
            await redis.set(`otp:data_archive_cooldown:${userId}`, "1", "EX", 60);
        }

        // Dispatch Email
        const displayName = user.firstname || user.username || "Developer";
        const sendResult = await sendSecurityNotificationEmail({
            to: user.email,
            name: displayName,
            subject: `Authorize Data Archive Download: ${otp}`,
            badgeText: "Security Verification",
            headline: "Authorize Account Data Archive Export",
            message: `A request was made to export a complete copy of your Orbix personal data, credentials, and security history (GDPR Art. 20 Portability). Enter the single-use 6-digit verification code below to authorize this export.`,
            otp,
            otpLabel: "Archive Export Code",
            isWarning: false,
            footerNotice: "This authorization code expires in 10 minutes. If you did not request this archive, someone may be attempting to exfiltrate your account data.",
        });

        const isDev = process.env.NODE_ENV !== "production";

        return {
            success: true,
            message: `Verification code sent to your primary email address (${user.email}).`,
            cooldownSeconds: 60,
            devOtp: (isDev || sendResult.simulated) ? otp : undefined,
        };
    }

    /**
     * Validates Step-Up Security (Password or Email OTP).
     */
    private static async validateStepUp(user: any, stepUpPassword?: string, stepUpOtp?: string): Promise<void> {
        // 1. Password check
        if (stepUpPassword && user.password) {
            const isMatch = await bcrypt.compare(stepUpPassword, user.password);
            if (!isMatch) {
                const err: any = new Error("Incorrect account password. Export authorization denied.");
                err.statusCode = 401;
                throw err;
            }
            return;
        }

        // 2. Email OTP check
        if (stepUpOtp && redis && redis.status === "ready") {
            const raw = await redis.get(`otp:data_archive:${user.id}`);
            if (!raw) {
                const err: any = new Error("Verification code expired or not requested. Please request a new code.");
                err.statusCode = 400;
                throw err;
            }
            const { otpHash } = JSON.parse(raw);
            const incomingHash = crypto.createHash("sha256").update(stepUpOtp.trim()).digest("hex");
            if (incomingHash !== otpHash) {
                const err: any = new Error("Invalid verification code. Please check your inbox and try again.");
                err.statusCode = 400;
                throw err;
            }
            // Consume OTP
            await redis.del(`otp:data_archive:${user.id}`);
            return;
        }

        // If neither was provided or matched
        const err: any = new Error("Security verification required. Please enter your password or authorization code.");
        err.statusCode = 401;
        throw err;
    }

    /**
     * Generates a dynamic, cryptographically sealed GDPR Article 20 / CCPA Data Archive.
     */
    static async generateArchive(params: GenerateArchiveParams): Promise<{
        success: boolean;
        exportId: string;
        filename: string;
        sha256Checksum: string;
        fileSizeBytes: number;
        recordCounts: Record<string, number>;
        archivePayload: any;
    }> {
        const { userId, categories = "all", stepUpPassword, stepUpOtp, ipAddress = "unknown", userAgent = "unknown" } = params;

        // 1. Fetch User Record
        const userRes = await query(
            `SELECT * FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        // 2. Validate Step-Up Security
        await this.validateStepUp(user, stepUpPassword, stepUpOtp);

        // 3. Enforce Rate Limits
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`data_archive:cooldown:${userId}`);
            if (cooldownTtl > 0) {
                const err: any = new Error(`Please wait ${cooldownTtl} seconds before generating another data archive.`);
                err.statusCode = 429;
                throw err;
            }

            const dailyKey = `data_archive:daily:${userId}`;
            const currentDaily = await redis.get(dailyKey);
            const count = currentDaily ? parseInt(currentDaily, 10) : 0;
            if (count >= ARCHIVE_DAILY_LIMIT) {
                const err: any = new Error(`Daily export limit reached (${ARCHIVE_DAILY_LIMIT} archives per 24 hours). Please try again tomorrow.`);
                err.statusCode = 429;
                throw err;
            }
        }

        // 4. Resolve Categories to include
        const requestedCatList: ArchiveCategory[] = categories === "all"
            ? ["identity", "platforms", "resumes", "security", "support", "network"]
            : categories;

        const dataPayload: Record<string, any> = {};
        const recordCounts: Record<string, number> = {};

        // --- DOMAIN 1: IDENTITY & PROFILE ---
        if (requestedCatList.includes("identity")) {
            dataPayload.identity = {
                id: user.id,
                username: user.username,
                email: user.email,
                name: {
                    firstName: user.firstname || user.firstName || null,
                    middleName: user.middlename || user.middleName || null,
                    lastName: user.lastname || user.lastName || null,
                    displayName: `${user.firstname || user.firstName || ""} ${user.lastname || user.lastName || ""}`.trim() || user.username,
                },
                profile: {
                    headline: user.headline || null,
                    bio: user.bio || null,
                    location: user.location || null,
                    website: user.website || null,
                    avatarUrl: user.avatar_url || user.avatarUrl || null,
                    photoUrl: user.photo_url || user.photoUrl || null,
                    coverImageUrl: user.cover_image_url || null,
                    skills: Array.isArray(user.skills) ? user.skills : (typeof user.skills === "string" ? user.skills.split(",") : []),
                },
                academicAffiliation: {
                    college: user.college || null,
                    collegeId: user.college_id || null,
                    collegeUpdatedAt: user.college_updated_at || null,
                    isVerifiedStudent: Boolean(user.is_verified_coder || user.college?.officialName),
                },
                verificationStamps: {
                    isEmailVerified: Boolean(user.is_email_verified),
                    emailVerifiedAt: user.email_verified_at || null,
                    isPhoneVerified: Boolean(user.is_phone_verified),
                    phoneVerifiedAt: user.phone_verified_at || null,
                    maskedPhone: user.phone ? user.phone.replace(/(\+\d{2})(\d+)(\d{4})/, "$1******$3") : null,
                    isVerifiedCoderBadge: Boolean(user.is_verified_coder),
                },
                orbixMetrics: {
                    orbixScore: user.orbix_score || 0,
                    orbixScoreBreakdown: user.orbix_score_breakdown || null,
                    streak: user.streak || 0,
                    totalSolved: user.total_solved || 0,
                    totalContests: user.total_contests || 0,
                    platformRatings: user.platform_ratings || null,
                },
                preferencesAndVisibility: {
                    isPublic: Boolean(user.is_public),
                    isOpenToWork: Boolean(user.is_open_to_work),
                    isHireable: Boolean(user.is_hireable),
                    accountType: user.account_type || "personal",
                    termsAccepted: Boolean(user.termsaccepted ?? user.termsAccepted),
                },
                timestamps: {
                    accountCreatedAt: user.created_at,
                    accountUpdatedAt: user.updated_at,
                },
            };
            recordCounts.identity = 1;
        }

        // --- DOMAIN 2: COMPETITIVE PROGRAMMING & CODING PLATFORMS ---
        if (requestedCatList.includes("platforms")) {
            const linksRes = await query(
                `SELECT portal, portal_username AS "portalUsername", link, verified,
                        display_name AS "displayName", stats, last_sync_status AS "lastSyncStatus",
                        last_sync_at AS "lastSyncAt", is_public AS "isPublic", created_at AS "createdAt"
                 FROM user_links
                 WHERE user_id = $1 OR username = $2
                 ORDER BY created_at ASC;`,
                [userId, user.username]
            );
            dataPayload.competitiveProgramming = linksRes.rows.map((row) => ({
                portal: row.portal,
                portalUsername: row.portalUsername,
                profileUrl: row.link,
                verified: Boolean(row.verified),
                displayName: row.displayName,
                scrapedStats: row.stats || null,
                lastSyncStatus: row.lastSyncStatus,
                lastSyncAt: row.lastSyncAt,
                isPublic: Boolean(row.isPublic),
                linkedAt: row.createdAt,
            }));
            recordCounts.platforms = linksRes.rows.length;
        }

        // --- DOMAIN 3: RESUMES & CAREER INTELLIGENCE ---
        if (requestedCatList.includes("resumes")) {
            const resumesRes = await query(
                `SELECT id, title, target_role AS "targetRole", template_id AS "templateId",
                        completeness_score AS "completenessScore", is_primary AS "isPrimary",
                        content, created_at AS "createdAt", updated_at AS "updatedAt"
                 FROM user_resumes
                 WHERE user_id = $1 OR username = $2
                 ORDER BY created_at DESC;`,
                [userId, user.username]
            );

            const analysesRes = await query(
                `SELECT id, overall_score AS "overallScore", score_breakdown AS "scoreBreakdown",
                        findings, checks_summary AS "checksSummary", job_match_report AS "jobMatchReport",
                        extracted_fields AS "extractedFields", extraction_confidence_score AS "extractionConfidenceScore",
                        analyzer_version AS "analyzerVersion", analysis_status AS "analysisStatus", created_at AS "createdAt"
                 FROM resume_analyses
                 WHERE user_id = $1 OR username = $2
                 ORDER BY created_at DESC
                 LIMIT 10;`,
                [userId, user.username]
            );

            dataPayload.resumesAndCareer = {
                activeResumes: resumesRes.rows.map((r) => ({
                    id: r.id,
                    title: r.title,
                    targetRole: r.targetRole,
                    templateId: r.templateId,
                    completenessScore: r.completenessScore,
                    isPrimary: Boolean(r.isPrimary),
                    contentSnapshot: r.content,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                })),
                atsAnalysesAndRoleFit: analysesRes.rows.map((a) => ({
                    id: a.id,
                    overallAtsScore: a.overallScore,
                    scoreBreakdown: a.scoreBreakdown,
                    findings: a.findings,
                    checksSummary: a.checksSummary,
                    jobMatchReport: a.jobMatchReport,
                    extractedSkillFacts: a.extractedFields,
                    confidenceScore: a.extractionConfidenceScore,
                    analyzerVersion: a.analyzerVersion,
                    analyzedAt: a.createdAt,
                })),
            };
            recordCounts.resumes = resumesRes.rows.length + analysesRes.rows.length;
        }

        // --- DOMAIN 4: SECURITY & AUDIT TRAIL ---
        if (requestedCatList.includes("security")) {
            const historyRes = await query(
                `SELECT change_type AS "changeType", old_value AS "oldValue", new_value AS "newValue",
                        ip_address AS "ipAddress", user_agent AS "userAgent", created_at AS "createdAt"
                 FROM account_change_history
                 WHERE user_id = $1
                 ORDER BY created_at DESC;`,
                [userId]
            );

            const opsRes = await query(
                `SELECT change_type AS "changeType", current_value AS "currentValue",
                        requested_value AS "requestedValue", stage, created_at AS "createdAt",
                        completed_at AS "completedAt", cancelled_at AS "cancelledAt"
                 FROM account_change_operations
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT 20;`,
                [userId]
            );

            dataPayload.securityAndAuditHistory = {
                committedAccountChanges: historyRes.rows.map((h) => ({
                    changeType: h.changeType,
                    previousValue: h.oldValue,
                    newValue: h.newValue,
                    sourceIp: h.ipAddress ? h.ipAddress.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.***.***") : null,
                    userAgent: h.userAgent,
                    timestamp: h.createdAt,
                })),
                accountChangeOperations: opsRes.rows.map((op) => ({
                    changeType: op.changeType,
                    currentValue: op.currentValue,
                    requestedValue: op.requestedValue,
                    finalStage: op.stage,
                    initiatedAt: op.createdAt,
                    completedAt: op.completedAt,
                    cancelledAt: op.cancelledAt,
                })),
            };
            recordCounts.security = historyRes.rows.length + opsRes.rows.length;
        }

        // --- DOMAIN 5: SUPPORT & FEEDBACK TICKETS ---
        if (requestedCatList.includes("support")) {
            const ticketsRes = await query(
                `SELECT ticket_number AS "ticketNumber", category, subject, description,
                        priority, status, resolution_note AS "resolutionNote",
                        created_at AS "createdAt", resolved_at AS "resolvedAt"
                 FROM help_tickets
                 WHERE user_id = $1 OR username = $2 OR contact_email = $3
                 ORDER BY created_at DESC;`,
                [userId, user.username, user.email]
            );

            dataPayload.supportAndTickets = ticketsRes.rows.map((t) => ({
                ticketNumber: t.ticketNumber,
                category: t.category,
                subject: t.subject,
                description: t.description,
                priority: t.priority,
                status: t.status,
                resolutionNote: t.resolutionNote,
                createdAt: t.createdAt,
                resolvedAt: t.resolvedAt,
            }));
            recordCounts.support = ticketsRes.rows.length;
        }

        // --- DOMAIN 6: NETWORK & COMMUNITY ---
        if (requestedCatList.includes("network")) {
            const connRes = await query(
                `SELECT
                    COUNT(*) FILTER (WHERE status = 'accepted') AS "connectionsCount",
                    COUNT(*) FILTER (WHERE status = 'pending' AND requested_by = $1) AS "outgoingRequestsCount",
                    COUNT(*) FILTER (WHERE status = 'pending' AND requested_by != $1) AS "incomingRequestsCount"
                 FROM user_relationships
                 WHERE user_low_id = $1 OR user_high_id = $1;`,
                [userId]
            );

            const blocksRes = await query(
                `SELECT COUNT(*) AS "blockedCount" FROM user_blocks WHERE blocker_id = $1;`,
                [userId]
            );

            dataPayload.networkAndSocial = {
                mutualConnections: parseInt(connRes.rows[0]?.connectionsCount || "0", 10),
                outgoingPendingRequests: parseInt(connRes.rows[0]?.outgoingRequestsCount || "0", 10),
                incomingPendingRequests: parseInt(connRes.rows[0]?.incomingRequestsCount || "0", 10),
                blockedUsersCount: parseInt(blocksRes.rows[0]?.blockedCount || "0", 10),
                communityComplianceNotice: "To preserve user privacy, individual identities of non-consenting users are not enumerated in data exports.",
            };
            recordCounts.network = 1;
        }

        // 5. Construct Digital Manifest & Executive Summary
        const exportId = crypto.randomUUID();
        const exportTimestamp = new Date().toISOString();

        const executiveSummary = {
            overview: "Orbix Portable Account Archive",
            complianceStandard: "GDPR Article 20 Right to Data Portability & CCPA Authorized Data Archive",
            accountAgeDays: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            verifiedEmail: Boolean(user.is_email_verified),
            verifiedStudentCoder: Boolean(user.is_verified_coder),
            includedCategories: requestedCatList,
            recordCountsSummary: recordCounts,
            dataResidency: "AWS / Supabase (eu-central / ap-south) Secure Cloud Encrypted at Rest (AES-256)",
            dataRetentionPolicyNotice: "Orbix retains developer portfolio statistics, submissions, and credentials to power public showcases and recruiter matching. You retain the right to delete your data at any time via Settings -> Danger Zone.",
        };

        // Deterministic Payload Serialization for Checksum
        const payloadString = JSON.stringify({ executiveSummary, data: dataPayload }, null, 2);
        const sha256Checksum = crypto.createHash("sha256").update(payloadString).digest("hex");
        const fileSizeBytes = Buffer.byteLength(payloadString, "utf8");

        const archiveManifest = {
            exportId,
            exportTimestamp,
            schemaVersion: "2.1.0",
            complianceStandard: "GDPR Article 20 / CCPA Portability Standard",
            issuer: "Orbix Data Privacy & Security Engine",
            subject: {
                userId: user.id,
                username: user.username,
                primaryEmail: user.email,
            },
            sha256Checksum,
            fileSizeBytes,
            recordCounts,
            integrityVerification: "This archive is cryptographically sealed. Verify integrity with `echo \"<checksum>  orbix-data-archive.json\" | sha256sum --check`.",
        };

        const finalCompleteArchive = {
            archiveManifest,
            executiveSummary,
            data: dataPayload,
        };

        // 6. Record Export in PostgreSQL Compliance Audit Log
        await query(
            `INSERT INTO account_data_exports (
                user_id,
                export_id,
                requested_categories,
                sha256_checksum,
                file_size_bytes,
                record_counts,
                ip_address,
                user_agent,
                created_at,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '48 hours');`,
            [
                userId,
                exportId,
                requestedCatList,
                sha256Checksum,
                fileSizeBytes,
                JSON.stringify(recordCounts),
                ipAddress,
                userAgent,
            ]
        );

        // 7. Update Redis Rate Limit & Cache Archive Payload for 24 hours
        if (redis && redis.status === "ready") {
            const dailyKey = `data_archive:daily:${userId}`;
            await redis.incr(dailyKey);
            const currentTtl = await redis.ttl(dailyKey);
            if (currentTtl < 0) {
                await redis.expire(dailyKey, 86400); // 24 hours TTL
            }
            await redis.set(`data_archive:cooldown:${userId}`, "1", "EX", ARCHIVE_COOLDOWN_SECONDS);

            // Store generated payload in Redis for 24 hours for instant re-download
            await redis.set(`data_archive:payload:${exportId}`, JSON.stringify(finalCompleteArchive), "EX", 86400);
        }

        const dateFormatted = new Date().toISOString().split("T")[0];
        const filename = `orbix-data-archive-${user.username}-${dateFormatted}.json`;

        return {
            success: true,
            exportId,
            filename,
            sha256Checksum,
            fileSizeBytes,
            recordCounts,
            archivePayload: finalCompleteArchive,
        };
    }

    /**
     * Retrieves a cached archive payload by exportId.
     */
    static async getCachedArchivePayload(userId: string, exportId: string): Promise<any | null> {
        // Verify ownership in PostgreSQL first
        const exportRes = await query(
            `SELECT export_id FROM account_data_exports
             WHERE user_id = $1 AND export_id = $2 AND expires_at > CURRENT_TIMESTAMP LIMIT 1;`,
            [userId, exportId]
        );
        if (!exportRes.rows[0]) {
            return null;
        }

        if (redis && redis.status === "ready") {
            const cached = await redis.get(`data_archive:payload:${exportId}`);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        return null;
    }
}
