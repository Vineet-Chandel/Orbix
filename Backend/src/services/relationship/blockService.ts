// Backend/src/services/relationship/blockService.ts
import { pool, query } from "../../database/client.js";
import { relationshipEvents } from "./relationshipEvents.js";
import { checkActionQuota, recordAction } from "./relationshipQuotaService.js";
import type { ViewerRelationshipState } from "./relationshipTypes.js";

export interface BlockCheckResult {
    isBlocked: boolean;
    blockState: 'blocked_by_me' | 'blocked_by_them' | 'none';
    blockerId?: string;
    blockedId?: string;
}

export interface BlockUserResult {
    success: boolean;
    message: string;
    outcome?: string | undefined;
    retryAfter?: number | undefined;
}

/**
 * Checks whether userA has blocked userB, or userB has blocked userA.
 */
export async function getBlockState(
    viewerId: string,
    targetUserId: string
): Promise<BlockCheckResult> {
    if (viewerId === targetUserId) {
        return { isBlocked: false, blockState: 'none' };
    }

    const res = await query(
        `SELECT blocker_id, blocked_id
         FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1;`,
        [viewerId, targetUserId]
    );

    if (res.rows.length === 0) {
        return { isBlocked: false, blockState: 'none' };
    }

    const row = res.rows[0];
    if (row.blocker_id === viewerId) {
        return {
            isBlocked: true,
            blockState: 'blocked_by_me',
            blockerId: row.blocker_id,
            blockedId: row.blocked_id,
        };
    } else {
        return {
            isBlocked: true,
            blockState: 'blocked_by_them',
            blockerId: row.blocker_id,
            blockedId: row.blocked_id,
        };
    }
}

/**
 * Directionally blocks a user.
 * Atomically ends any existing connection, cancels pending requests in either direction,
 * and clears unread connection-related notifications.
 */
export async function blockUser(
    blockerId: string,
    blockedId: string,
    reason?: string
): Promise<BlockUserResult> {
    if (blockerId === blockedId) {
        throw new Error("You cannot block yourself.");
    }

    // Strict block quota check: max 20/day, max 50/week (also counting repeated blocks to same target)
    const quota = await checkActionQuota(blockerId, "block");
    if (!quota.allowed) {
        relationshipEvents.logEvent("relationship_action_denied", {
            actorId: blockerId,
            targetUserId: blockedId,
            reason: `quota_exceeded_${quota.limitType}`,
            metadata: {
                limitType: quota.limitType,
                dailyCount: quota.dailyCount,
                weeklyCount: quota.weeklyCount,
            },
        });
        return {
            success: false,
            outcome: "rate_limited",
            retryAfter: quota.retryAfterSeconds,
            message: quota.message || "User block quota exceeded.",
        };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");

        // 1. Insert block record
        await client.query(
            `INSERT INTO user_blocks (blocker_id, blocked_id, reason, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (blocker_id, blocked_id) DO NOTHING;`,
            [blockerId, blockedId, reason || null]
        );

        // 2. Identify canonical pair
        const [lowId, highId] = [blockerId, blockedId].sort();

        // 3. Atomically transition existing relationship to removed/cancelled
        await client.query(
            `UPDATE user_relationships
             SET status = CASE
                    WHEN status = 'connected' THEN 'removed'
                    WHEN status = 'pending' THEN 'cancelled'
                    ELSE status
                 END,
                 last_action_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_low_id = $1 AND user_high_id = $2;`,
            [lowId, highId]
        );

        // 4. Suppress unread relationship notifications between both parties
        await client.query(
            `UPDATE user_notifications
             SET is_read = true, read_at = CURRENT_TIMESTAMP
             WHERE (actor_id = $1 AND recipient_id = $2)
                OR (actor_id = $2 AND recipient_id = $1);`,
            [blockerId, blockedId]
        );

        // 5. Record block action in durable PostgreSQL log and Redis sliding window
        await recordAction(blockerId, blockedId, "block", client);

        await client.query("COMMIT;");

        relationshipEvents.logEvent("user_blocked", {
            actorId: blockerId,
            targetUserId: blockedId,
            reason,
        });

        return {
            success: true,
            message: "User blocked successfully.",
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("blockUser error:", err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Unblocks a previously blocked user.
 * Explicitly guaranteed: Unblocking does NOT restore any previous connection or request.
 */
export async function unblockUser(
    blockerId: string,
    blockedId: string
): Promise<{ success: boolean; message: string }> {
    const res = await query(
        `DELETE FROM user_blocks
         WHERE blocker_id = $1 AND blocked_id = $2
         RETURNING id;`,
        [blockerId, blockedId]
    );

    relationshipEvents.logEvent("user_unblocked", {
        actorId: blockerId,
        targetUserId: blockedId,
    });

    return {
        success: true,
        message: res.rowCount && res.rowCount > 0 ? "User unblocked successfully." : "User was not blocked.",
    };
}

/**
 * Retrieves paginated list of blocked accounts for the current user's Settings.
 */
export async function getBlockedUsers(
    blockerId: string,
    limit = 20,
    cursor?: string
): Promise<{
    blockedUsers: Array<{
        id: string;
        blockedId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        headline: string | null;
        blockedAt: string;
    }>;
    nextCursor: string | null;
    totalCount: number;
}> {
    const totalCountRes = await query(
        `SELECT COUNT(*)::int AS count FROM user_blocks WHERE blocker_id = $1;`,
        [blockerId]
    );
    const totalCount = totalCountRes.rows[0]?.count ?? 0;

    let queryStr = `
        SELECT
            b.id AS block_id,
            b.blocked_id,
            b.created_at AS blocked_at,
            u.username,
            COALESCE(u.firstname || ' ' || u.lastname, u.username) AS display_name,
            COALESCE(u.photo_url, u.avatar_url) AS avatar_url,
            u.photo_url,
            u.headline
        FROM user_blocks b
        JOIN users u ON b.blocked_id = u.id
        WHERE b.blocker_id = $1
    `;
    const params: any[] = [blockerId];

    if (cursor) {
        params.push(cursor);
        queryStr += ` AND b.created_at < $${params.length}::timestamptz `;
    }

    params.push(limit + 1);
    queryStr += ` ORDER BY b.created_at DESC LIMIT $${params.length};`;

    const res = await query(queryStr, params);

    const hasMore = res.rows.length > limit;
    const items = hasMore ? res.rows.slice(0, limit) : res.rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].blocked_at : null;

    const blockedUsers = items.map((r) => ({
        id: r.block_id,
        blockedId: r.blocked_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.photo_url || r.avatar_url || null,
        photoUrl: r.photo_url || r.avatar_url || null,
        headline: r.headline,
        blockedAt: r.blocked_at.toISOString ? r.blocked_at.toISOString() : r.blocked_at,
    }));

    return {
        blockedUsers,
        nextCursor,
        totalCount,
    };
}
