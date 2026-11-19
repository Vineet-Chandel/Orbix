/**
 * Certificate Studio Notification & Reveal Service (Phase 15)
 * Dispatches spoiler-protected certificate notifications with low-resolution previews,
 * supports bulk batch notification grouping, and manages reveal state transitions.
 */
import { query } from "../../database/client.js";

export interface RecipientAwardItem {
    id: string;
    credential_code: string;
    title: string;
    certificate_type: string;
    recipient_name: string;
    issue_date: any;
    sha256_hash?: string | undefined;
    isTeam?: boolean | undefined;
    teamName?: string | undefined;
    awardPosition?: string | undefined;
}

export interface UserAwardsEntry {
    user: { id: string; username: string; name?: string | undefined };
    certs: RecipientAwardItem[];
}

export class CertificateNotificationService {
    /**
     * Capitalizes award category for display (e.g. "participation" -> "Participation")
     */
    static formatType(type: string): string {
        if (!type) return "Participation";
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

    /**
     * Dispatches certificate notifications to recipients.
     * Groups multiple certificates awarded to the same user in a single batch into:
     * "You received 3 certificates from ABC Coding Club."
     * Never fails the parent batch if a notification delivery errors out.
     */
    static async dispatchCertificateNotifications(
        dbClient: { query: (sql: string, params?: any[]) => Promise<any> },
        params: {
            club: { id: string; name: string; slug: string; logo_url?: string | undefined };
            eventRecord: { id?: string | undefined; title: string } | null;
            batchId: string;
            userAwardsMap: Map<string, UserAwardsEntry>;
        }
    ): Promise<void> {
        const { club, eventRecord, batchId, userAwardsMap } = params;

        for (const [userId, entry] of userAwardsMap.entries()) {
            try {
                const { user, certs } = entry;
                if (!certs || certs.length === 0) continue;

                if (certs.length === 1) {
                    const cert = certs[0];
                    if (!cert) continue;
                    const notifTitle = `🎓 You've received a certificate!`;
                    const typeLabel = `Certificate of ${this.formatType(cert.certificate_type)}`;
                    const notifBody = eventRecord
                        ? `${club.name} has awarded you a ${typeLabel} for ${eventRecord.title}.`
                        : `${club.name} has awarded you a ${typeLabel} for "${cert.title}".`;

                    const notifMetadata = JSON.stringify({
                        type: "club_certificate",
                        notification_type: cert.isTeam ? "team_certificate_awarded" : "certificate_awarded",
                        certificateId: cert.id,
                        credentialCode: cert.credential_code,
                        clubId: club.id,
                        clubName: club.name,
                        clubSlug: club.slug,
                        clubLogo: club.logo_url || null,
                        eventId: eventRecord ? eventRecord.id || null : null,
                        eventTitle: eventRecord?.title || null,
                        certificateType: cert.certificate_type,
                        certificateTitle: cert.title,
                        title: cert.title,
                        issueDate: cert.issue_date,
                        recipientName: cert.recipient_name,
                        awardPosition: cert.awardPosition || null,
                        isTeam: Boolean(cert.isTeam),
                        teamName: cert.teamName || null,
                        sha256Hash: cert.sha256_hash || null,
                        previewUrl: `/api/club/certificates/${encodeURIComponent(cert.credential_code)}/preview`,
                        previewBlurredUrl: `/api/club/certificates/${encodeURIComponent(cert.credential_code)}/preview?blurred=true`,
                        isSpoiler: true,
                        isRevealed: false,
                        revealMessage: "Your certificate is ready. Tap to reveal your achievement.",
                    });

                    await dbClient.query(
                        `INSERT INTO user_notifications (
                            user_id, recipient_id, username, title, body,
                            type, notification_type, metadata, idempotency_key, is_read, created_at
                        ) VALUES (
                            $1, $1, $2, $3, $4,
                            'club_certificate', $5, $6::jsonb, $7, false, NOW()
                        )
                        ON CONFLICT (idempotency_key) DO UPDATE SET
                            title = EXCLUDED.title,
                            body = EXCLUDED.body,
                            metadata = EXCLUDED.metadata;`,
                        [
                            userId,
                            user.username || user.name || "Student",
                            notifTitle,
                            notifBody,
                            cert.isTeam ? "team_certificate_awarded" : "certificate_awarded",
                            notifMetadata,
                            cert.isTeam ? `team-cert-${cert.id}-${userId}` : `cert-${cert.id}`,
                        ]
                    );
                } else {
                    // Grouped bulk notification (Phase 15: "You received 3 certificates from ABC Coding Club.")
                    const notifTitle = `🎓 You received ${certs.length} certificates from ${club.name}!`;
                    const notifBody = `You received ${certs.length} certificates from ${club.name}${
                        eventRecord ? ` for ${eventRecord.title}` : ""
                    }. Tap to reveal your achievements.`;

                    const notifMetadata = JSON.stringify({
                        type: "club_certificate",
                        notification_type: "certificate_batch_awarded",
                        isGrouped: true,
                        batchId,
                        count: certs.length,
                        totalCertificates: certs.length,
                        clubId: club.id,
                        clubName: club.name,
                        clubSlug: club.slug,
                        clubLogo: club.logo_url || null,
                        eventId: eventRecord ? eventRecord.id || null : null,
                        eventTitle: eventRecord?.title || null,
                        isSpoiler: true,
                        isRevealed: false,
                        revealMessage: "Your certificates are ready. Tap to reveal your achievements.",
                        certificates: certs.map((c) => ({
                            certificateId: c.id,
                            credentialCode: c.credential_code,
                            title: c.title,
                            certificateTitle: c.title,
                            certificateType: c.certificate_type,
                            recipientName: c.recipient_name,
                            issueDate: c.issue_date,
                            sha256Hash: c.sha256_hash || null,
                            isTeam: Boolean(c.isTeam),
                            teamName: c.teamName || null,
                            awardPosition: c.awardPosition || null,
                            previewUrl: `/api/club/certificates/${encodeURIComponent(c.credential_code)}/preview`,
                            previewBlurredUrl: `/api/club/certificates/${encodeURIComponent(c.credential_code)}/preview?blurred=true`,
                            isRevealed: false,
                        })),
                    });

                    await dbClient.query(
                        `INSERT INTO user_notifications (
                            user_id, recipient_id, username, title, body,
                            type, notification_type, metadata, idempotency_key, is_read, created_at
                        ) VALUES (
                            $1, $1, $2, $3, $4,
                            'club_certificate', 'certificate_batch_awarded', $5::jsonb, $6, false, NOW()
                        )
                        ON CONFLICT (idempotency_key) DO UPDATE SET
                            title = EXCLUDED.title,
                            body = EXCLUDED.body,
                            metadata = EXCLUDED.metadata;`,
                        [
                            userId,
                            user.username || user.name || "Student",
                            notifTitle,
                            notifBody,
                            notifMetadata,
                            `cert-batch-${batchId}-${userId}`,
                        ]
                    );
                }
            } catch (notifErr: any) {
                console.warn(`[Phase 15] Notification delivery warning for user ${userId}:`, notifErr?.message || notifErr);
            }
        }
    }

    /**
     * Helper to dispatch grouped batch notifications
     */
    static async dispatchBatchNotifications(params: {
        clubId: string;
        batchId: string;
        title: string;
        recipientSnapshots: Array<{
            userId: string;
            certificateId: string;
            credentialCode: string;
            recipientName: string;
            category?: string;
        }>;
    }): Promise<{ dispatchedCount: number }> {
        const clubRes = await query(`SELECT id, name, slug, logo_url FROM verified_clubs WHERE id = $1 LIMIT 1;`, [params.clubId]);
        const club = clubRes.rows[0] || { id: params.clubId, name: "Campus Club", slug: "club" };

        const userAwardsMap = new Map<string, UserAwardsEntry>();
        for (const r of params.recipientSnapshots) {
            if (!r.userId) continue;
            let entry = userAwardsMap.get(r.userId);
            if (!entry) {
                entry = {
                    user: { id: r.userId, username: r.recipientName, name: r.recipientName },
                    certs: [],
                };
                userAwardsMap.set(r.userId, entry);
            }
            entry.certs.push({
                id: r.certificateId,
                credential_code: r.credentialCode,
                certificate_type: r.category || "excellence",
                recipient_name: r.recipientName,
                title: params.title,
                issue_date: new Date().toISOString(),
            });
        }

        await this.dispatchCertificateNotifications({ query }, {
            club,
            eventRecord: { title: params.title },
            batchId: params.batchId,
            userAwardsMap,
        });

        return { dispatchedCount: userAwardsMap.size };
    }
}
