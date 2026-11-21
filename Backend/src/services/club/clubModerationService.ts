import { query } from "../../database/client.js";
import redis from "../../redis/client.js";

export interface ClubModerationState {
    isMuted: boolean;
    mutedAt: Date | null;
    muteReason: string | null;
    isBlocked: boolean;
    blockedAt: Date | null;
    blockReason: string | null;
}

const MODERATION_CACHE_TTL_SEC = 60;

function getModerationCacheKey(clubId: string, userId: string): string {
    return `mod:club:${clubId}:user:${userId}`;
}

/**
 * Retrieves the moderation state for a specific user within a specific club.
 * Highly optimized with Redis cache and index-only PostgreSQL fallback.
 */
export async function getClubModerationState(
    clubId: string,
    userId: string
): Promise<ClubModerationState> {
    const defaultState: ClubModerationState = {
        isMuted: false,
        mutedAt: null,
        muteReason: null,
        isBlocked: false,
        blockedAt: null,
        blockReason: null,
    };

    if (!clubId || !userId) return defaultState;

    const cacheKey = getModerationCacheKey(clubId, userId);
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            return {
                ...parsed,
                mutedAt: parsed.mutedAt ? new Date(parsed.mutedAt) : null,
                blockedAt: parsed.blockedAt ? new Date(parsed.blockedAt) : null,
            };
        }
    } catch {
        // Fall back to database query on cache miss or redis issue
    }

    const res = await query(
        `SELECT is_muted, muted_at, mute_reason, is_blocked, blocked_at, block_reason
         FROM club_user_moderation
         WHERE club_id = $1 AND user_id = $2
         LIMIT 1;`,
        [clubId, userId]
    );

    if (res.rows.length === 0) {
        try {
            await redis.set(cacheKey, JSON.stringify(defaultState), "EX", MODERATION_CACHE_TTL_SEC);
        } catch {
            // non-blocking
        }
        return defaultState;
    }

    const row = res.rows[0];
    const state: ClubModerationState = {
        isMuted: Boolean(row.is_muted),
        mutedAt: row.muted_at ? new Date(row.muted_at) : null,
        muteReason: row.mute_reason || null,
        isBlocked: Boolean(row.is_blocked),
        blockedAt: row.blocked_at ? new Date(row.blocked_at) : null,
        blockReason: row.block_reason || null,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(state), "EX", MODERATION_CACHE_TTL_SEC);
    } catch {
        // non-blocking
    }

    return state;
}

/**
 * Mutes a user for a specific club.
 * Muting suppresses active notifications and filters future messages into the Muted view.
 */
export async function muteUserForClub({
    clubId,
    userId,
    staffId,
    reason,
}: {
    clubId: string;
    userId: string;
    staffId: string;
    reason?: string | null;
}): Promise<ClubModerationState> {
    const cleanReason = reason ? reason.trim().slice(0, 500) : null;

    const res = await query(
        `INSERT INTO club_user_moderation (
            club_id, user_id, is_muted, muted_at, muted_by, mute_reason, updated_at
        ) VALUES ($1, $2, true, NOW(), $3, $4, NOW())
        ON CONFLICT (club_id, user_id) DO UPDATE SET
            is_muted = true,
            muted_at = NOW(),
            muted_by = EXCLUDED.muted_by,
            mute_reason = EXCLUDED.mute_reason,
            updated_at = NOW()
        RETURNING is_muted, muted_at, mute_reason, is_blocked, blocked_at, block_reason;`,
        [clubId, userId, staffId, cleanReason]
    );

    try {
        await redis.del(getModerationCacheKey(clubId, userId));
    } catch {
        // ignore
    }

    const row = res.rows[0];
    return {
        isMuted: true,
        mutedAt: new Date(row.muted_at),
        muteReason: row.mute_reason || null,
        isBlocked: Boolean(row.is_blocked),
        blockedAt: row.blocked_at ? new Date(row.blocked_at) : null,
        blockReason: row.block_reason || null,
    };
}

/**
 * Unmutes a user for a specific club, restoring standard notification and visibility behavior.
 */
export async function unmuteUserForClub(
    clubId: string,
    userId: string
): Promise<ClubModerationState> {
    const res = await query(
        `UPDATE club_user_moderation
         SET is_muted = false,
             muted_at = NULL,
             muted_by = NULL,
             mute_reason = NULL,
             updated_at = NOW()
         WHERE club_id = $1 AND user_id = $2
         RETURNING is_muted, muted_at, mute_reason, is_blocked, blocked_at, block_reason;`,
        [clubId, userId]
    );

    try {
        await redis.del(getModerationCacheKey(clubId, userId));
    } catch {
        // ignore
    }

    const row = res.rows[0] || {};
    return {
        isMuted: false,
        mutedAt: null,
        muteReason: null,
        isBlocked: Boolean(row.is_blocked),
        blockedAt: row.blocked_at ? new Date(row.blocked_at) : null,
        blockReason: row.block_reason || null,
    };
}

/**
 * Blocks a user for a specific club.
 * Blocking denies messaging, protected club access, and event RSVP/attendance.
 */
export async function blockUserForClub({
    clubId,
    userId,
    staffId,
    reason,
}: {
    clubId: string;
    userId: string;
    staffId: string;
    reason?: string | null;
}): Promise<ClubModerationState> {
    const cleanReason = reason ? reason.trim().slice(0, 500) : null;

    // 1. Upsert moderation block record
    const res = await query(
        `INSERT INTO club_user_moderation (
            club_id, user_id, is_blocked, blocked_at, blocked_by, block_reason, updated_at
        ) VALUES ($1, $2, true, NOW(), $3, $4, NOW())
        ON CONFLICT (club_id, user_id) DO UPDATE SET
            is_blocked = true,
            blocked_at = NOW(),
            blocked_by = EXCLUDED.blocked_by,
            block_reason = EXCLUDED.block_reason,
            updated_at = NOW()
        RETURNING is_muted, muted_at, mute_reason, is_blocked, blocked_at, block_reason;`,
        [clubId, userId, staffId, cleanReason]
    );

    // 2. Mark any active event registrations for this user as 'blocked'
    await query(
        `UPDATE club_event_registrations
         SET status = 'blocked',
             updated_at = NOW()
         WHERE club_id = $1 AND user_id = $2 AND status = 'registered';`,
        [clubId, userId]
    ).catch(() => {});

    try {
        await redis.del(getModerationCacheKey(clubId, userId));
    } catch {
        // ignore
    }

    const row = res.rows[0];
    return {
        isMuted: Boolean(row.is_muted),
        mutedAt: row.muted_at ? new Date(row.muted_at) : null,
        muteReason: row.mute_reason || null,
        isBlocked: true,
        blockedAt: new Date(row.blocked_at),
        blockReason: row.block_reason || null,
    };
}

/**
 * Unblocks a user for a specific club, restoring public permissions.
 */
export async function unblockUserForClub(
    clubId: string,
    userId: string
): Promise<ClubModerationState> {
    const res = await query(
        `UPDATE club_user_moderation
         SET is_blocked = false,
             blocked_at = NULL,
             blocked_by = NULL,
             block_reason = NULL,
             updated_at = NOW()
         WHERE club_id = $1 AND user_id = $2
         RETURNING is_muted, muted_at, mute_reason, is_blocked, blocked_at, block_reason;`,
        [clubId, userId]
    );

    try {
        await redis.del(getModerationCacheKey(clubId, userId));
    } catch {
        // ignore
    }

    const row = res.rows[0] || {};
    return {
        isMuted: Boolean(row.is_muted),
        mutedAt: row.muted_at ? new Date(row.muted_at) : null,
        muteReason: row.mute_reason || null,
        isBlocked: false,
        blockedAt: null,
        blockReason: null,
    };
}

/**
 * Lists all moderated users (muted or blocked) for a specific club.
 */
export async function listModeratedUsers(clubId: string) {
    const res = await query(
        `SELECT
            m.user_id AS "userId",
            m.is_muted AS "isMuted",
            m.muted_at AS "mutedAt",
            m.mute_reason AS "muteReason",
            m.is_blocked AS "isBlocked",
            m.blocked_at AS "blockedAt",
            m.block_reason AS "blockReason",
            m.updated_at AS "updatedAt",
            u.username,
            u.firstname AS "firstName",
            u.lastname AS "lastName",
            COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
            u.email AS "email"
         FROM club_user_moderation m
         JOIN users u ON u.id = m.user_id
         WHERE m.club_id = $1 AND (m.is_muted = true OR m.is_blocked = true)
         ORDER BY m.updated_at DESC;`,
        [clubId]
    );

    return res.rows;
}
