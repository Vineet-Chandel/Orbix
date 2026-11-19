// Backend/src/services/account/accountPurgeService.ts
import crypto from "node:crypto";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";

export interface PurgeResult {
    processedCount: number;
    purgedRequests: Array<{
        requestId: string;
        userId?: string | null;
        emailHash: string;
        username?: string;
        status: string;
    }>;
    errors: Array<{
        requestId: string;
        error: string;
    }>;
}

/**
 * Executes permanent purging of accounts whose 7-day grace period has expired.
 * Preserves relational database integrity, invalidates caches, queues Cloudinary assets
 * for deletion, and keeps anonymized audit records.
 */
export async function processPendingAccountDeletions(): Promise<PurgeResult> {
    const result: PurgeResult = {
        processedCount: 0,
        purgedRequests: [],
        errors: [],
    };

    try {
        // 1. Fetch pending deletion requests whose scheduled grace period has expired
        const expiredRes = await query(
            `SELECT id, user_id, status, scheduled_for, created_at, requested_ip
             FROM account_deletion_requests
             WHERE status = 'scheduled' AND scheduled_for <= NOW()
             ORDER BY scheduled_for ASC
             LIMIT 50;`
        );

        if (expiredRes.rows.length === 0) {
            return result;
        }

        console.log(`[AccountPurgeWorker] Found ${expiredRes.rows.length} expired deletion request(s) to purge.`);

        for (const reqRow of expiredRes.rows) {
            const requestId = reqRow.id;
            const targetUserId = reqRow.user_id;

            try {
                // 2. Mark as processing to prevent concurrent worker conflicts
                await query(
                    `UPDATE account_deletion_requests
                     SET status = 'processing', updated_at = NOW()
                     WHERE id = $1 AND status = 'scheduled';`,
                    [requestId]
                );

                if (!targetUserId) {
                    // User was already deleted or unlinked
                    await query(
                        `UPDATE account_deletion_requests
                         SET status = 'completed',
                             completed_at = NOW(),
                             purge_log = '{"note":"User ID was null, marked completed"}'::jsonb,
                             updated_at = NOW()
                         WHERE id = $1;`,
                        [requestId]
                    );
                    result.processedCount++;
                    result.purgedRequests.push({
                        requestId,
                        userId: null,
                        emailHash: "unknown",
                        status: "completed",
                    });
                    continue;
                }

                // 3. Inspect target user data
                const userRes = await query(
                    `SELECT id, email, username, photo_public_id, previous_photo_public_id, avatar_url
                     FROM users
                     WHERE id = $1
                     LIMIT 1;`,
                    [targetUserId]
                );

                if (userRes.rows.length === 0) {
                    // User row no longer exists in users table
                    await query(
                        `UPDATE account_deletion_requests
                         SET status = 'completed',
                             completed_at = NOW(),
                             purge_log = '{"note":"User row already removed from users table"}'::jsonb,
                             updated_at = NOW()
                         WHERE id = $1;`,
                        [requestId]
                    );
                    result.processedCount++;
                    result.purgedRequests.push({
                        requestId,
                        userId: targetUserId,
                        emailHash: "user_already_deleted",
                        status: "completed",
                    });
                    continue;
                }

                const targetUser = userRes.rows[0];
                const email = targetUser.email || "";
                const username = targetUser.username || "";
                const emailHash = crypto
                    .createHash("sha256")
                    .update(email.toLowerCase().trim())
                    .digest("hex");

                const assetCleanupLog: string[] = [];

                // 4. Queue profile photos for Cloudinary deletion
                if (targetUser.photo_public_id) {
                    try {
                        await query(
                            `INSERT INTO photo_cleanup_queue (public_id, reason, status)
                             VALUES ($1, 'account_purge_primary', 'pending')
                             ON CONFLICT DO NOTHING;`,
                            [targetUser.photo_public_id]
                        );
                        assetCleanupLog.push(`queued_photo:${targetUser.photo_public_id}`);
                    } catch (photoErr: any) {
                        console.warn(`[AccountPurgeWorker] Warning queueing photo ${targetUser.photo_public_id}:`, photoErr?.message);
                    }
                }

                if (targetUser.previous_photo_public_id && targetUser.previous_photo_public_id !== targetUser.photo_public_id) {
                    try {
                        await query(
                            `INSERT INTO photo_cleanup_queue (public_id, reason, status)
                             VALUES ($1, 'account_purge_previous', 'pending')
                             ON CONFLICT DO NOTHING;`,
                            [targetUser.previous_photo_public_id]
                        );
                        assetCleanupLog.push(`queued_prev_photo:${targetUser.previous_photo_public_id}`);
                    } catch (prevPhotoErr: any) {
                        console.warn(`[AccountPurgeWorker] Warning queueing prev photo:`, prevPhotoErr?.message);
                    }
                }

                // 5. Clean up auxiliary tables matched on username or user_id
                try {
                    await query(`DELETE FROM user_links WHERE user_id = $1 OR username = $2;`, [targetUserId, username]);
                    await query(`DELETE FROM user_resumes WHERE user_id = $1 OR username = $2;`, [targetUserId, username]);
                } catch (auxErr: any) {
                    console.warn(`[AccountPurgeWorker] Warning deleting auxiliary user records:`, auxErr?.message);
                }

                // 6. Invalidate all Redis caches for this user
                try {
                    await deleteUserDetailsCache(targetUserId);
                    if (email) await deleteUserDetailsCache(email);
                    if (username) await deleteUserDetailsCache(username);

                    if (redis && redis.status === "ready") {
                        // Scan and evict user session keys and preferences
                        const patterns = [
                            `auth:user:*${username}*`,
                            `session:*${targetUserId}*`,
                            `privacy:*${targetUserId}*`,
                            `otp:*${targetUserId}*`,
                            `data_archive:*${targetUserId}*`,
                        ];

                        for (const pat of patterns) {
                            try {
                                const keys = await redis.keys(pat);
                                if (keys && keys.length > 0) {
                                    await redis.del(...keys);
                                }
                            } catch {
                                // Non-fatal cache key eviction
                            }
                        }
                    }
                } catch (cacheErr: any) {
                    console.warn(`[AccountPurgeWorker] Warning clearing cache for user ${targetUserId}:`, cacheErr?.message);
                }

                // 7. Permanently delete user row from users table.
                // Because account_deletion_requests.user_id has ON DELETE SET NULL, the request row remains.
                // Other dependent tables cascade delete cleanly.
                await query(`DELETE FROM users WHERE id = $1;`, [targetUserId]);

                // 8. Update account_deletion_requests with completed status and compliance audit log
                const purgeSummary = {
                    purgedAt: new Date().toISOString(),
                    userEmailHash: emailHash,
                    usernameMasked: username ? `${username.slice(0, 2)}***` : "unknown",
                    gracePeriodDays: reqRow.grace_period_days || 7,
                    scheduledFor: reqRow.scheduled_for,
                    assetsQueued: assetCleanupLog,
                };

                await query(
                    `UPDATE account_deletion_requests
                     SET status = 'completed',
                         completed_at = NOW(),
                         user_email_hash = $1,
                         purge_log = $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $3;`,
                    [emailHash, JSON.stringify(purgeSummary), requestId]
                );

                console.log(`[AccountPurgeWorker] Successfully purged user account for request ${requestId} (email hash: ${emailHash.slice(0, 8)}...).`);

                result.processedCount++;
                result.purgedRequests.push({
                    requestId,
                    userId: targetUserId,
                    emailHash,
                    username,
                    status: "completed",
                });
            } catch (itemErr: any) {
                console.error(`[AccountPurgeWorker] Error processing deletion request ${requestId}:`, itemErr);

                // Revert status to scheduled so it can be retried later
                await query(
                    `UPDATE account_deletion_requests
                     SET status = 'scheduled',
                         purge_log = jsonb_set(COALESCE(purge_log, '{}'::jsonb), '{last_error}', $1::jsonb),
                         updated_at = NOW()
                     WHERE id = $2;`,
                    [JSON.stringify(itemErr?.message || "Unknown purge error"), requestId]
                );

                result.errors.push({
                    requestId,
                    error: itemErr?.message || "Purge execution failed",
                });
            }
        }
    } catch (globalErr: any) {
        console.error("[AccountPurgeWorker] Fatal error running purge worker:", globalErr);
    }

    return result;
}

let workerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the automated periodic purge worker (runs every 60 minutes).
 */
export function startAccountPurgeWorker(intervalMs = 60 * 60 * 1000) {
    if (workerInterval) return;

    // Run first check after a brief initial warm-up delay (30 seconds)
    setTimeout(() => {
        processPendingAccountDeletions().catch((err) => {
            console.error("[AccountPurgeWorker] Initial run failed:", err);
        });
    }, 30000);

    // Schedule regular hourly runs
    workerInterval = setInterval(() => {
        processPendingAccountDeletions().catch((err) => {
            console.error("[AccountPurgeWorker] Periodic run failed:", err);
        });
    }, intervalMs);

    if (workerInterval.unref) {
        workerInterval.unref();
    }

    console.log(`[AccountPurgeWorker] Background account deletion worker started (interval: ${intervalMs / 1000 / 60}m).`);
}

/**
 * Stops the automated periodic purge worker.
 */
export function stopAccountPurgeWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        console.log("[AccountPurgeWorker] Background account deletion worker stopped.");
    }
}
