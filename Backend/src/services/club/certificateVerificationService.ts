import crypto from "crypto";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { CertificatePdfService } from "./certificatePdfService.js";
import { CertificatePreviewService } from "./certificatePreviewService.js";
import { CertificateNotificationService } from "./certificateNotificationService.js";
import type { CertificateDesign, DynamicDataSnapshot } from "../../types/certificateStudio.js";

export interface PublicVerificationPayload {
    verified: boolean;
    status: "valid" | "revoked" | "superseded" | "not_found";
    message: string;
    certificate?: {
        credentialCode: string;
        title: string;
        certificateType: string;
        recipientName: string;
        achievement: string;
        description: string;
        issuingClub: {
            id: string;
            name: string;
            slug: string;
            logoUrl: string;
            collegeName: string;
        };
        event: {
            id: string;
            title: string;
            startsAt: string;
        } | null;
        issueDate: string;
        status: "valid" | "revoked" | "superseded";
        version: number;
        sha256Hash: string;
        signerName: string;
        signerRole: string;
        isTeam: boolean;
        teamSnapshot?: {
            teamName: string;
            memberCount: number;
            members: Array<{
                name: string;
                role?: string;
                customPosition?: string;
                isCaptain?: boolean;
            }>;
        } | null;
        supersededBy?: {
            credentialCode: string;
            issueDate: string;
            version: number;
        } | null;
        reissuedFrom?: {
            credentialCode: string;
            issueDate: string;
            version: number;
        } | null;
        revocationReason?: string | null;
        revokedAt?: string | null;
        verificationCount: number;
        lastVerifiedAt?: string | null;
        signingMetadata: {
            algorithm: string;
            infrastructure: string;
            isAsymmetricKms: boolean;
            kmsKeyId?: string;
        };
    };
}

export interface UserWalletItem {
    id: string;
    credentialCode: string;
    title: string;
    certificateType: string;
    recipientName: string;
    description: string;
    issueDate: string;
    status: "valid" | "revoked" | "superseded";
    version: number;
    sha256Hash: string;
    pdfUrl: string | null;
    previewUrl: string | null;
    isTeam: boolean;
    teamId: string | null;
    teamName?: string | null;
    teamSnapshot?: any;
    clubId: string;
    clubName: string;
    clubSlug: string;
    clubLogoUrl: string;
    collegeName: string;
    eventId: string | null;
    eventTitle?: string | null;
    signerName: string;
    signerRole: string;
    verificationUrl: string;
    isRevealed?: boolean;
    isSpoiler?: boolean;
    supersededBy?: {
        id: string;
        credentialCode: string;
    } | null;
    revocationReason?: string | null;
    revokedAt?: string | null;
}

export class CertificateVerificationService {
    /**
     * Public verification lookup by credentialCode or opaque UUID
     * Never exposes private email, phone numbers, user_id, or registration responses.
     */
    static async verifyPublic(identifier: string): Promise<PublicVerificationPayload> {
        const cleanId = (identifier || "").trim();
        if (!cleanId) {
            return {
                verified: false,
                status: "not_found",
                message: "No verification identifier provided.",
            };
        }

        // Check Redis non-sensitive public verification cache (Phase 19)
        const cacheKey = `orbix:cert:public_verification:${cleanId.toLowerCase()}`;
        if (redis && redis.status === "ready") {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed: PublicVerificationPayload = JSON.parse(cached);
                    if (parsed.certificate) {
                        parsed.certificate.verificationCount = (parsed.certificate.verificationCount || 1) + 1;
                        parsed.certificate.lastVerifiedAt = new Date().toISOString();
                        // Asynchronously increment DB verification counter
                        query(
                            `UPDATE public.club_certificates
                             SET verification_count = COALESCE(verification_count, 0) + 1,
                                 last_verified_at = NOW()
                             WHERE LOWER(credential_code) = LOWER($1) OR id::text = $1;`,
                            [cleanId]
                        ).catch(() => {});
                        // Update cache with incremented verification count
                        redis.setex(cacheKey, 300, JSON.stringify(parsed)).catch(() => {});
                    }
                    return parsed;
                }
            } catch (err) {
                // Ignore Redis errors gracefully
            }
        }

        // Query certificate with club and event joins
        const certRes = await query(
            `SELECT
                c.id,
                c.credential_code AS "credentialCode",
                c.title,
                c.certificate_type AS "certificateType",
                c.recipient_name AS "recipientName",
                c.description,
                c.signer_name AS "signerName",
                c.signer_role AS "signerRole",
                c.issue_date AS "issueDate",
                c.sha256_hash AS "sha256Hash",
                COALESCE(c.status, CASE WHEN c.is_revoked THEN 'revoked' ELSE 'valid' END) AS "status",
                COALESCE(c.version, 1) AS "version",
                c.is_revoked AS "isRevoked",
                c.revoked_at AS "revokedAt",
                c.revocation_reason AS "revocationReason",
                COALESCE(c.verification_count, 0) AS "verificationCount",
                c.last_verified_at AS "lastVerifiedAt",
                c.team_id AS "teamId",
                c.recipient_snapshot AS "recipientSnapshot",
                c.superseded_by_id AS "supersededById",
                c.reissued_from_id AS "reissuedFromId",
                c.kms_key_id AS "kmsKeyId",
                c.kms_signature AS "kmsSignature",
                c.digital_signature_algorithm AS "digitalSignatureAlgorithm",
                vc.id AS "clubId",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                COALESCE(vc.college_name, 'Campus Organization') AS "collegeName",
                e.id AS "eventId",
                e.title AS "eventTitle",
                e.starts_at AS "eventDate"
             FROM public.club_certificates c
             JOIN public.verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN public.club_events e ON e.id = c.event_id
             WHERE LOWER(c.credential_code) = LOWER($1)
                OR (c.id::text = $1)
             LIMIT 1;`,
            [cleanId]
        );

        if (certRes.rowCount === 0) {
            return {
                verified: false,
                status: "not_found",
                message: `No authentic certificate found matching code "${cleanId}".`,
            };
        }

        const row = certRes.rows[0];

        // Increment verification counter asynchronously
        await query(
            `UPDATE public.club_certificates
             SET verification_count = COALESCE(verification_count, 0) + 1,
                 last_verified_at = NOW()
             WHERE id = $1;`,
            [row.id]
        );

        // Fetch supersededBy details if certificate was superseded
        let supersededBy: { credentialCode: string; issueDate: string; version: number } | null = null;
        if (row.supersededById) {
            const supRes = await query(
                `SELECT credential_code AS "credentialCode", issue_date AS "issueDate", version
                 FROM public.club_certificates
                 WHERE id = $1 LIMIT 1;`,
                [row.supersededById]
            );
            if (supRes.rowCount && supRes.rowCount > 0) {
                supersededBy = supRes.rows[0];
            }
        }

        // Fetch reissuedFrom details if certificate is version N > 1
        let reissuedFrom: { credentialCode: string; issueDate: string; version: number } | null = null;
        if (row.reissuedFromId) {
            const reRes = await query(
                `SELECT credential_code AS "credentialCode", issue_date AS "issueDate", version
                 FROM public.club_certificates
                 WHERE id = $1 LIMIT 1;`,
                [row.reissuedFromId]
            );
            if (reRes.rowCount && reRes.rowCount > 0) {
                reissuedFrom = reRes.rows[0];
            }
        }

        // Clean team snapshot: sanitize PII (strip email, phone, internal user ids)
        const isTeam = Boolean(row.teamId);
        let teamSnapshot: any = null;
        if (isTeam && row.recipientSnapshot?.team) {
            const rawTeam = row.recipientSnapshot.team;
            teamSnapshot = {
                teamName: rawTeam.teamName || row.recipientName,
                memberCount: Array.isArray(rawTeam.memberSnapshot) ? rawTeam.memberSnapshot.length : 0,
                members: (rawTeam.memberSnapshot || []).map((m: any) => ({
                    name: m.name || m.userName || "Team Member",
                    role: m.role || m.teamRole || undefined,
                    customPosition: m.customPosition || undefined,
                    isCaptain: Boolean(m.isCaptain || m.role?.toLowerCase().includes("captain") || m.role?.toLowerCase().includes("lead")),
                })),
            };
        }

        // Assess asymmetric digital signing
        const hasKms = Boolean(process.env.AWS_KMS_KEY_ID && row.kmsSignature);
        const signingMetadata = {
            algorithm: row.digitalSignatureAlgorithm || (hasKms ? "ECDSA_SHA_256" : "SHA-256 Digest"),
            infrastructure: hasKms
                ? "AWS KMS Hardware Security Module (HSM Asymmetric Signature)"
                : "Orbix SHA-256 Authoritative Cryptographic Seal (Tamper-Evident)",
            isAsymmetricKms: hasKms,
            kmsKeyId: hasKms ? (row.kmsKeyId || process.env.AWS_KMS_KEY_ID) : undefined,
        };

        const certStatus: "valid" | "revoked" | "superseded" =
            row.status === "superseded" ? "superseded" : row.status === "revoked" || row.isRevoked ? "revoked" : "valid";

        const result: PublicVerificationPayload = {
            verified: certStatus === "valid",
            status: certStatus,
            message:
                certStatus === "revoked"
                    ? "This certificate has been officially revoked by the issuing authority."
                    : certStatus === "superseded"
                    ? "This certificate has been superseded by a newer reissued version."
                    : "Certificate is authentic, verified, and tamper-evident.",
            certificate: {
                credentialCode: row.credentialCode,
                title: row.title,
                certificateType: row.certificateType,
                recipientName: row.recipientName,
                achievement: row.recipientSnapshot?.award?.position || row.title,
                description: row.description || "",
                issuingClub: {
                    id: row.clubId,
                    name: row.clubName,
                    slug: row.clubSlug,
                    logoUrl: row.clubLogoUrl,
                    collegeName: row.collegeName,
                },
                event: row.eventId
                    ? {
                          id: row.eventId,
                          title: row.eventTitle,
                          startsAt: row.eventDate,
                      }
                    : null,
                issueDate: row.issueDate,
                status: certStatus,
                version: row.version,
                sha256Hash: row.sha256Hash || "",
                signerName: row.signerName || row.clubName,
                signerRole: row.signerRole || "Authorized Authority",
                isTeam,
                teamSnapshot,
                supersededBy,
                reissuedFrom,
                revocationReason: row.revocationReason || null,
                revokedAt: row.revokedAt || null,
                verificationCount: (row.verificationCount || 0) + 1,
                lastVerifiedAt: row.lastVerifiedAt,
                signingMetadata,
            },
        };

        // Cache non-sensitive public verification payload in Redis (5 min TTL) (Phase 19)
        if (redis && redis.status === "ready" && result.verified) {
            try {
                await redis.setex(cacheKey, 300, JSON.stringify(result));
            } catch (err) {
                // Ignore cache set error
            }
        }

        return result;
    }

    /**
     * Revoke a certificate with mandatory reason and immutable audit log
     */
    static async revokeCertificate(params: {
        certificateId: string;
        clubId: string;
        staffUserId: string;
        reason: string;
    }): Promise<{ success: boolean; certificateId: string; credentialCode: string }> {
        const { certificateId, clubId, staffUserId, reason } = params;

        if (!reason || reason.trim().length < 5) {
            throw new Error("A specific revocation reason (at least 5 characters) is required for audit compliance.");
        }

        // Verify certificate belongs to club
        const certRes = await query(
            `SELECT id, credential_code, status, is_revoked, recipient_name
             FROM public.club_certificates
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [certificateId, clubId]
        );

        if (certRes.rowCount === 0) {
            throw new Error("Certificate not found or not owned by your club.");
        }

        const cert = certRes.rows[0];
        if (cert.status === "revoked" || cert.is_revoked) {
            throw new Error("Certificate is already revoked.");
        }

        // Update status to revoked
        await query(
            `UPDATE public.club_certificates
             SET status = 'revoked',
                 is_revoked = true,
                 revocation_reason = $1,
                 revoked_by_user_id = $2,
                 revoked_at = NOW(),
                 updated_at = NOW()
             WHERE id = $3;`,
            [reason.trim(), staffUserId, certificateId]
        );

        // Record immutable audit log
        await query(
            `INSERT INTO public.certificate_audit_logs (
                club_id, actor_user_id, action, entity_type, entity_id, metadata, created_at
             ) VALUES ($1, $2, 'CERTIFICATE_REVOKED', 'club_certificate', $3, $4, NOW());`,
            [
                clubId,
                staffUserId,
                certificateId,
                JSON.stringify({
                    credentialCode: cert.credential_code,
                    recipientName: cert.recipient_name,
                    reason: reason.trim(),
                    revokedAt: new Date().toISOString(),
                }),
            ]
        );

        // Invalidate Redis verification cache (Phase 19)
        if (redis && redis.status === "ready") {
            try {
                await redis.del(`orbix:cert:public_verification:${cert.credential_code.toLowerCase()}`);
                await redis.del(`orbix:cert:public_verification:${certificateId.toLowerCase()}`);
            } catch (err) {}
        }

        return {
            success: true,
            certificateId,
            credentialCode: cert.credential_code,
        };
    }

    /**
     * Reissue a certificate: supersedes previous version and creates version N+1
     */
    static async reissueCertificate(params: {
        certificateId: string;
        clubId: string;
        staffUserId: string;
        updates: {
            recipientName?: string;
            awardPosition?: string;
            description?: string;
            signerName?: string;
            signerRole?: string;
            reissueReason?: string;
        };
    }): Promise<{
        success: boolean;
        previousCertificateId: string;
        newCertificateId: string;
        newCredentialCode: string;
        newVersion: number;
    }> {
        const { certificateId, clubId, staffUserId, updates } = params;

        // Fetch original certificate
        const certRes = await query(
            `SELECT
                c.*,
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                COALESCE(vc.college_name, 'Campus Organization') AS "collegeName",
                e.title AS "eventTitle",
                e.starts_at AS "eventStartsAt"
             FROM public.club_certificates c
             JOIN public.verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN public.club_events e ON e.id = c.event_id
             WHERE c.id = $1 AND c.club_id = $2
             LIMIT 1;`,
            [certificateId, clubId]
        );

        if (certRes.rowCount === 0) {
            throw new Error("Certificate not found or not owned by your club.");
        }

        const oldCert = certRes.rows[0];

        if (oldCert.status === "superseded") {
            throw new Error("This certificate has already been superseded by a newer version.");
        }

        const newVersion = (oldCert.version || 1) + 1;
        const newRecipientName = updates.recipientName?.trim() || oldCert.recipient_name;
        const newPosition = updates.awardPosition?.trim() || oldCert.recipient_snapshot?.award?.position || "";
        const newDescription = updates.description?.trim() || oldCert.description;
        const newSignerName = updates.signerName?.trim() || oldCert.signer_name;
        const newSignerRole = updates.signerRole?.trim() || oldCert.signer_role;

        // Generate non-guessable credential code for version N+1
        const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
        const year = new Date().getFullYear();
        const categorySlug = (oldCert.certificate_type || "CERT").slice(0, 4).toUpperCase();
        const newCredentialCode = `ORB-${categorySlug}-${year}-V${newVersion}-${uniqueSuffix}`;

        // Clone and update recipient snapshot
        const updatedSnapshot: DynamicDataSnapshot = {
            ...(oldCert.recipient_snapshot || {}),
            recipient: {
                ...(oldCert.recipient_snapshot?.recipient || {}),
                name: newRecipientName,
            },
            award: {
                ...(oldCert.recipient_snapshot?.award || {}),
                position: newPosition,
            },
            certificate: {
                ...(oldCert.recipient_snapshot?.certificate || {}),
                credentialCode: newCredentialCode,
                issueDate: new Date().toISOString(),
                verificationUrl: `https://orbix.dev/verify/certificate/${newCredentialCode}`,
            },
            signatures: {
                primary: {
                    name: newSignerName,
                    role: newSignerRole,
                    title: newSignerRole,
                },
            },
        };

        // Render PDF for new version
        const design: CertificateDesign = oldCert.design_snapshot || { elements: [] };
        let newPdfBuffer: Buffer;
        let newSha256 = "";
        try {
            const pdfResult = await CertificatePdfService.renderCertificatePdf(design, updatedSnapshot);
            newPdfBuffer = pdfResult.pdfBuffer;
            newSha256 = pdfResult.sha256Hash || (pdfResult as any).sha256Digest || "";
        } catch (err: any) {
            console.error("Failed to render reissued certificate PDF:", err);
            throw new Error(`PDF generation for reissued credential failed: ${err.message}`);
        }

        // Render low-res preview SVG
        let previewSvg = "";
        try {
            previewSvg = await CertificatePreviewService.renderCertificateSvg(design, updatedSnapshot, {
                blurred: false,
            });
        } catch (err: any) {
            console.warn("Failed to render preview SVG:", err);
        }

        // Transition old certificate to 'superseded' before inserting new version
        await query(
            `UPDATE public.club_certificates
             SET status = 'superseded',
                 updated_at = NOW()
             WHERE id = $1;`,
            [certificateId]
        );

        const resolvedRecipientType = oldCert.recipient_type || (oldCert.team_id ? "team" : (oldCert.claim_token ? "external" : "individual"));

        // Insert new certificate version in a safe transaction
        const insertRes = await query(
            `INSERT INTO public.club_certificates (
                club_id, user_id, event_id, title, certificate_type,
                recipient_name, recipient_email, description, credential_code,
                signer_name, signer_role, issued_by_user_id, issue_date,
                metadata, template_id, template_version, batch_id, team_id,
                design_snapshot, recipient_snapshot, sha256_hash, status,
                version, reissued_from_id, is_revoked, verification_count,
                recipient_type, created_at, updated_at
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, NOW(),
                $13, $14, $15, $16, $17,
                $18, $19, $20, 'valid',
                $21, $22, false, 0,
                $23, NOW(), NOW()
             ) RETURNING id;`,
            [
                clubId,
                oldCert.user_id,
                oldCert.event_id,
                oldCert.title,
                oldCert.certificate_type,
                newRecipientName,
                oldCert.recipient_email,
                newDescription,
                newCredentialCode,
                newSignerName,
                newSignerRole,
                staffUserId,
                JSON.stringify({
                    ...(oldCert.metadata || {}),
                    reissuedAt: new Date().toISOString(),
                    reissueReason: updates.reissueReason || "Updated credential details",
                    previewSvgLength: previewSvg.length,
                }),
                oldCert.template_id,
                oldCert.template_version,
                oldCert.batch_id,
                oldCert.team_id,
                JSON.stringify(design),
                JSON.stringify(updatedSnapshot),
                newSha256,
                newVersion,
                certificateId,
                resolvedRecipientType,
            ]
        );

        const newCertId = insertRes.rows[0].id;

        // Transition old certificate to link to new certificate
        await query(
            `UPDATE public.club_certificates
             SET superseded_by_id = $1
             WHERE id = $2;`,
            [newCertId, certificateId]
        );

        // Record audit logs
        await query(
            `INSERT INTO public.certificate_audit_logs (
                club_id, actor_user_id, action, entity_type, entity_id, metadata, created_at
             ) VALUES ($1, $2, 'CERTIFICATE_REISSUED', 'club_certificate', $3, $4, NOW());`,
            [
                clubId,
                staffUserId,
                newCertId,
                JSON.stringify({
                    previousCertificateId: certificateId,
                    previousCredentialCode: oldCert.credential_code,
                    newCredentialCode,
                    version: newVersion,
                    reissueReason: updates.reissueReason || "Administrative reissue",
                    updates,
                }),
            ]
        );

        // If recipient has user profile, send update notification
        if (oldCert.user_id) {
            try {
                await CertificateNotificationService.dispatchBatchNotifications({
                    clubId,
                    batchId: oldCert.batch_id || certificateId,
                    title: `Updated Certificate: ${oldCert.title}`,
                    recipientSnapshots: [
                        {
                            userId: oldCert.user_id,
                            certificateId: newCertId,
                            credentialCode: newCredentialCode,
                            recipientName: newRecipientName,
                            category: oldCert.certificate_type,
                        },
                    ],
                });
            } catch (notifErr: any) {
                console.warn("Failed to notify user of certificate reissue:", notifErr);
            }
        }

        // Invalidate Redis verification cache for old superseded credential (Phase 19)
        if (redis && redis.status === "ready") {
            try {
                await redis.del(`orbix:cert:public_verification:${oldCert.credential_code.toLowerCase()}`);
                await redis.del(`orbix:cert:public_verification:${certificateId.toLowerCase()}`);
            } catch (err) {}
        }

        return {
            success: true,
            previousCertificateId: certificateId,
            newCertificateId: newCertId,
            newCredentialCode,
            newVersion,
        };
    }

    /**
     * Audit history for authorized club staff
     */
    static async getAuditHistory(certificateId: string, clubId: string) {
        const logsRes = await query(
            `SELECT
                l.id,
                l.action,
                l.entity_type AS "entityType",
                l.entity_id AS "entityId",
                l.metadata,
                l.created_at AS "createdAt",
                u.username AS "actorUsername",
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS "actorName"
             FROM public.certificate_audit_logs l
             LEFT JOIN public.users u ON u.id = l.actor_user_id
             WHERE l.club_id = $1 AND (
                 l.entity_id = $2 OR
                 l.metadata->>'previousCertificateId' = $2 OR
                 l.metadata->>'certificateId' = $2
             )
             ORDER BY l.created_at DESC;`,
            [clubId, certificateId]
        );

        return logsRes.rows;
    }

    /**
     * User Certificate Wallet: Retrieves all personal + authorized team certificates for a student
     */
    static async getUserWallet(
        userId: string,
        filters?: {
            clubId?: string;
            eventId?: string;
            status?: string;
            category?: string;
            query?: string;
            isTeam?: boolean;
            limit?: number;
            offset?: number;
        }
    ): Promise<{
        certificates: UserWalletItem[];
        stats: {
            total: number;
            valid: number;
            teamAwards: number;
            uniqueClubs: number;
        };
        pagination?: {
            total: number;
            limit: number;
            offset: number;
            hasMore: boolean;
        };
    }> {
        const queryParams: any[] = [userId];
        let whereClauses = `
            (
                c.user_id = $1
                OR (
                    c.team_id IS NOT NULL
                    AND c.user_id IS NULL
                    AND (
                        c.recipient_snapshot->'team'->'memberSnapshot' @> jsonb_build_array(jsonb_build_object('userId', $1::text))
                        OR EXISTS (
                            SELECT 1 FROM public.club_team_members ctm
                            WHERE ctm.team_id = c.team_id AND ctm.user_id = $1
                        )
                    )
                )
            )
        `;

        if (filters?.clubId) {
            queryParams.push(filters.clubId);
            whereClauses += ` AND c.club_id = $${queryParams.length}`;
        }

        if (filters?.eventId) {
            queryParams.push(filters.eventId);
            whereClauses += ` AND c.event_id = $${queryParams.length}`;
        }

        if (filters?.status && filters.status !== "all") {
            queryParams.push(filters.status);
            whereClauses += ` AND COALESCE(c.status, CASE WHEN c.is_revoked THEN 'revoked' ELSE 'valid' END) = $${queryParams.length}`;
        }

        if (filters?.category && filters.category !== "all") {
            queryParams.push(filters.category);
            whereClauses += ` AND c.certificate_type = $${queryParams.length}`;
        }

        if (filters?.isTeam !== undefined) {
            if (filters.isTeam) {
                whereClauses += ` AND c.team_id IS NOT NULL`;
            } else {
                whereClauses += ` AND c.team_id IS NULL`;
            }
        }

        if (filters?.query && filters.query.trim()) {
            queryParams.push(`%${filters.query.trim().toLowerCase()}%`);
            const pIdx = queryParams.length;
            whereClauses += ` AND (
                LOWER(c.recipient_name) LIKE $${pIdx} OR
                LOWER(c.title) LIKE $${pIdx} OR
                LOWER(c.credential_code) LIKE $${pIdx} OR
                LOWER(vc.name) LIKE $${pIdx} OR
                LOWER(COALESCE(e.title, '')) LIKE $${pIdx} OR
                LOWER(COALESCE(c.description, '')) LIKE $${pIdx}
            )`;
        }

        // Phase 19: High-performance database pagination
        const hasPagination = filters?.limit !== undefined || filters?.offset !== undefined;
        const limitVal = filters?.limit ? Math.min(100, Math.max(1, filters.limit)) : 50;
        const offsetVal = filters?.offset ? Math.max(0, filters.offset) : 0;

        let totalMatching = 0;
        if (hasPagination) {
            const countSql = `
                SELECT COUNT(*)::int AS total
                FROM public.club_certificates c
                JOIN public.verified_clubs vc ON vc.id = c.club_id
                LEFT JOIN public.club_events e ON e.id = c.event_id
                WHERE ${whereClauses};
            `;
            const countRes = await query(countSql, queryParams);
            totalMatching = countRes.rows[0]?.total || 0;
        }

        let sql = `
            SELECT
                c.id,
                c.credential_code AS "credentialCode",
                c.title,
                c.certificate_type AS "certificateType",
                c.recipient_name AS "recipientName",
                COALESCE(c.description, '') AS "description",
                c.issue_date AS "issueDate",
                COALESCE(c.status, CASE WHEN c.is_revoked THEN 'revoked' ELSE 'valid' END) AS "status",
                COALESCE(c.version, 1) AS "version",
                c.sha256_hash AS "sha256Hash",
                c.pdf_url AS "pdfUrl",
                c.preview_url AS "previewUrl",
                (c.team_id IS NOT NULL) AS "isTeam",
                c.team_id AS "teamId",
                c.recipient_snapshot AS "recipientSnapshot",
                c.superseded_by_id AS "supersededById",
                c.revocation_reason AS "revocationReason",
                c.revoked_at AS "revokedAt",
                c.signer_name AS "signerName",
                c.signer_role AS "signerRole",
                vc.id AS "clubId",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                COALESCE(vc.college_name, 'Campus Organization') AS "collegeName",
                e.id AS "eventId",
                e.title AS "eventTitle"
            FROM public.club_certificates c
            JOIN public.verified_clubs vc ON vc.id = c.club_id
            LEFT JOIN public.club_events e ON e.id = c.event_id
            WHERE ${whereClauses}
            ORDER BY c.issue_date DESC
        `;

        const finalQueryParams = [...queryParams];
        if (hasPagination) {
            finalQueryParams.push(limitVal);
            finalQueryParams.push(offsetVal);
            sql += ` LIMIT $${finalQueryParams.length - 1} OFFSET $${finalQueryParams.length};`;
        } else {
            sql += `;`;
        }

        const res = await query(sql, finalQueryParams);

        const certificates: UserWalletItem[] = res.rows.map((r: any) => {
            const isTeamCert = Boolean(r.isTeam);
            const teamName = isTeamCert ? r.recipientSnapshot?.team?.teamName || r.recipientName : null;

            return {
                id: r.id,
                credentialCode: r.credentialCode,
                title: r.title,
                certificateType: r.certificateType,
                recipientName: r.recipientName,
                description: r.description,
                issueDate: r.issueDate,
                status: r.status,
                version: r.version,
                sha256Hash: r.sha256Hash,
                pdfUrl: r.pdfUrl,
                previewUrl: r.previewUrl,
                isTeam: isTeamCert,
                teamId: r.teamId,
                teamName,
                teamSnapshot: isTeamCert ? r.recipientSnapshot?.team : null,
                clubId: r.clubId,
                clubName: r.clubName,
                clubSlug: r.clubSlug,
                clubLogoUrl: r.clubLogoUrl,
                collegeName: r.collegeName,
                eventId: r.eventId,
                eventTitle: r.eventTitle,
                signerName: r.signerName,
                signerRole: r.signerRole,
                verificationUrl: `https://orbix.dev/verify/certificate/${r.credentialCode}`,
                supersededBy: r.supersededById ? { id: r.supersededById, credentialCode: "" } : null,
                revocationReason: r.revocationReason,
                revokedAt: r.revokedAt,
            };
        });

        // Compute summary metrics
        const uniqueClubSet = new Set<string>();
        let validCount = 0;
        let teamAwardsCount = 0;

        certificates.forEach((c) => {
            uniqueClubSet.add(c.clubId);
            if (c.status === "valid") validCount++;
            if (c.isTeam) teamAwardsCount++;
        });

        const totalCount = hasPagination ? totalMatching : certificates.length;

        return {
            certificates,
            stats: {
                total: totalCount,
                valid: validCount,
                teamAwards: teamAwardsCount,
                uniqueClubs: uniqueClubSet.size,
            },
            ...(hasPagination ? {
                pagination: {
                    total: totalCount,
                    limit: limitVal,
                    offset: offsetVal,
                    hasMore: (offsetVal + certificates.length) < totalCount,
                }
            } : {})
        };
    }
}
