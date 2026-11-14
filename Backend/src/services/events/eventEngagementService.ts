// Backend/src/services/events/eventEngagementService.ts
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { dispatchNotification } from "../notification/quotaService.js";

export type EventShareType = "internal" | "external" | "copy_link";

export interface EventEngagementInfo {
    eventId: string;
    likeCount: number;
    likedByViewer: boolean;
    shareCount: number;
}

export interface RecipientShareOutcome {
    recipientUserId: string;
    success: boolean;
    isNewCount?: boolean | undefined;
    error?: string | undefined;
}

export interface RecordEventShareOptions {
    eventIdOrSlug: string;
    idempotencyKey: string;
    userId?: string | null | undefined;
    accountType?: string | undefined;
    shareType?: EventShareType | undefined;
    platform?: string | undefined;
    recipientUserId?: string | null | undefined;
    recipientUserIds?: string[] | undefined;
    message?: string | undefined;
    note?: string | undefined;
    rateLimitIdentifier?: string | undefined;
}

export interface RecordEventShareResult {
    eventId: string;
    shareCount: number;
    shareType: EventShareType;
    platform: string;
    recipientUserId?: string | null | undefined;
    recipientUserIds?: string[] | undefined;
    successfulDeliveries?: number | undefined;
    failedDeliveries?: number | undefined;
    deliveryOutcomes?: RecipientShareOutcome[] | undefined;
    counts: {
        publicShares: number;
        internalShares: number;
        externalShares: number;
        linkCopies: number;
    };
}

const COUNT_CACHE_TTL = 3600; // 1 hour
const VIEWER_CACHE_TTL = 300; // 5 minutes
const RATE_LIMIT_WINDOW_SECS = 60;
const MAX_SHARES_PER_WINDOW = 30;

/**
 * Checks whether Redis is ready to accept commands.
 */
function isRedisReady(): boolean {
    return Boolean(redis && redis.status === "ready");
}

/**
 * Validates UUID format (v1-v5).
 */
export function isValidUuid(val?: string | null): boolean {
    if (!val || typeof val !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Redis Key Helpers
 */
function getLikeCountKey(eventId: string): string {
    return `event:likes:count:${eventId.toLowerCase()}`;
}

function getViewerLikeKey(eventId: string, viewerId: string): string {
    return `event:likes:viewer:${eventId.toLowerCase()}:${viewerId.toLowerCase()}`;
}

function getShareCountKey(eventId: string): string {
    return `event:shares:count:${eventId.toLowerCase()}`;
}

function getShareRateLimitKey(identifier: string): string {
    return `event:share:ratelimit:${identifier}`;
}

/**
 * Resolves an event UUID from an ID or slug.
 */
export async function resolveEventId(eventIdOrSlug: string): Promise<string | null> {
    if (!eventIdOrSlug || typeof eventIdOrSlug !== "string") return null;
    const clean = eventIdOrSlug.trim();
    if (isValidUuid(clean)) return clean;

    const res = await query(
        `SELECT id FROM club_events WHERE slug = $1 LIMIT 1;`,
        [clean]
    );
    return res.rows[0]?.id || null;
}

/**
 * Explicitly invalidates Redis cache for an event.
 */
export async function invalidateEventEngagementCache(eventId: string): Promise<void> {
    if (!isRedisReady() || !isValidUuid(eventId)) return;
    try {
        await Promise.all([
            redis.del(getLikeCountKey(eventId)),
            redis.del(getShareCountKey(eventId)),
        ]);
    } catch {
        // Safe to ignore
    }
}

/**
 * Retrieves like count, share count, and viewer liked state for a single event.
 * Accessible to guests (viewerId = null -> likedByViewer = false) and authenticated users.
 * Checks Redis first, falling back to PostgreSQL.
 */
export async function getEventEngagement(
    eventIdOrSlug: string,
    viewerId?: string | null
): Promise<EventEngagementInfo | null> {
    const eventId = await resolveEventId(eventIdOrSlug);
    if (!eventId) return null;

    const isUuidViewer = isValidUuid(viewerId);

    // 1. Check Redis Cache
    if (isRedisReady()) {
        try {
            const [likeVal, shareVal] = await Promise.all([
                redis.get(getLikeCountKey(eventId)),
                redis.get(getShareCountKey(eventId)),
            ]);

            if (likeVal !== null && shareVal !== null) {
                const likeCount = parseInt(likeVal, 10) || 0;
                const shareCount = parseInt(shareVal, 10) || 0;

                // For guest users, viewer is never liked
                if (!isUuidViewer || !viewerId) {
                    return {
                        eventId,
                        likeCount,
                        likedByViewer: false,
                        shareCount,
                    };
                }

                // For authenticated viewers, check cached viewer state
                const viewerVal = await redis.get(getViewerLikeKey(eventId, viewerId));
                if (viewerVal !== null) {
                    return {
                        eventId,
                        likeCount,
                        likedByViewer: viewerVal === "1",
                        shareCount,
                    };
                }
            }
        } catch {
            // Fall through to database
        }
    }

    // 2. Query Authoritative PostgreSQL Database
    const sql = `
        SELECT
            e.id AS "eventId",
            (SELECT COUNT(*)::int FROM club_event_likes WHERE event_id = e.id) AS "likeCount",
            (SELECT COUNT(*)::int FROM club_event_shares WHERE event_id = e.id AND share_type IN ('internal', 'external') AND (account_type IS NULL OR account_type != 'club')) AS "shareCount",
            CASE
                WHEN $2::uuid IS NOT NULL THEN
                    EXISTS(SELECT 1 FROM club_event_likes WHERE event_id = e.id AND user_id = $2::uuid)
                ELSE false
            END AS "likedByViewer"
        FROM club_events e
        WHERE e.id = $1::uuid
        LIMIT 1;
    `;

    const res = await query(sql, [eventId, isUuidViewer ? viewerId : null]);
    const row = res.rows[0];
    if (!row) return null;

    const result: EventEngagementInfo = {
        eventId: row.eventId,
        likeCount: Number(row.likeCount) || 0,
        likedByViewer: Boolean(row.likedByViewer),
        shareCount: Number(row.shareCount) || 0,
    };

    // 3. Populate Redis Cache asynchronously
    if (isRedisReady()) {
        try {
            const pipeline = redis.pipeline();
            pipeline.set(getLikeCountKey(eventId), result.likeCount.toString(), "EX", COUNT_CACHE_TTL);
            pipeline.set(getShareCountKey(eventId), result.shareCount.toString(), "EX", COUNT_CACHE_TTL);
            if (isUuidViewer && viewerId) {
                pipeline.set(getViewerLikeKey(eventId, viewerId), result.likedByViewer ? "1" : "0", "EX", VIEWER_CACHE_TTL);
            }
            pipeline.exec().catch(() => {});
        } catch {
            // Ignore pipeline error
        }
    }

    return result;
}

/**
 * Retrieves like and share information for a batch of events.
 * Avoids N+1 queries by leveraging Redis cache and a single relational join query.
 * Limits batch size to 50 items.
 */
export async function getBatchEventEngagement(
    eventIdsOrSlugs: string[],
    viewerId?: string | null
): Promise<EventEngagementInfo[]> {
    if (!Array.isArray(eventIdsOrSlugs) || eventIdsOrSlugs.length === 0) {
        return [];
    }

    // Resolve & deduplicate valid IDs
    const resolvedIds = new Set<string>();
    for (const raw of eventIdsOrSlugs.slice(0, 50)) {
        if (!raw || typeof raw !== "string") continue;
        const clean = raw.trim();
        if (isValidUuid(clean)) {
            resolvedIds.add(clean.toLowerCase());
        }
    }

    const uniqueIds = Array.from(resolvedIds);
    if (uniqueIds.length === 0) return [];

    const isUuidViewer = isValidUuid(viewerId);

    // 1. Try Redis Cache for Entire Batch
    if (isRedisReady()) {
        try {
            const likeKeys = uniqueIds.map((id) => getLikeCountKey(id));
            const shareKeys = uniqueIds.map((id) => getShareCountKey(id));

            const [cachedLikes, cachedShares] = await Promise.all([
                redis.mget(...likeKeys),
                redis.mget(...shareKeys),
            ]);

            const allLikesPresent = cachedLikes.every((c) => c !== null && c !== undefined);
            const allSharesPresent = cachedShares.every((c) => c !== null && c !== undefined);

            // Fast path for guests
            if ((!isUuidViewer || !viewerId) && allLikesPresent && allSharesPresent) {
                return uniqueIds.map((id, idx) => ({
                    eventId: id,
                    likeCount: parseInt(cachedLikes[idx] || "0", 10) || 0,
                    likedByViewer: false,
                    shareCount: parseInt(cachedShares[idx] || "0", 10) || 0,
                }));
            }
        } catch {
            // Fall through to database
        }
    }

    // 2. Query Authoritative PostgreSQL Database
    const sql = `
        WITH target_events AS (
            SELECT unnest($1::uuid[]) AS id
        ),
        like_counts AS (
            SELECT event_id, COUNT(*)::int AS count
            FROM club_event_likes
            WHERE event_id IN (SELECT id FROM target_events)
            GROUP BY event_id
        ),
        share_counts AS (
            SELECT event_id, COUNT(*)::int AS count
            FROM club_event_shares
            WHERE event_id IN (SELECT id FROM target_events)
              AND share_type IN ('internal', 'external')
              AND (account_type IS NULL OR account_type != 'club')
            GROUP BY event_id
        ),
        viewer_likes AS (
            SELECT event_id, true AS liked
            FROM club_event_likes
            WHERE ($2::uuid IS NOT NULL AND user_id = $2::uuid)
              AND event_id IN (SELECT id FROM target_events)
        )
        SELECT
            t.id AS "eventId",
            COALESCE(lc.count, 0)::int AS "likeCount",
            COALESCE(sc.count, 0)::int AS "shareCount",
            COALESCE(vl.liked, false) AS "likedByViewer"
        FROM target_events t
        JOIN club_events e ON e.id = t.id
        LEFT JOIN like_counts lc ON lc.event_id = t.id
        LEFT JOIN share_counts sc ON sc.event_id = t.id
        LEFT JOIN viewer_likes vl ON vl.event_id = t.id;
    `;

    const res = await query(sql, [uniqueIds, isUuidViewer ? viewerId : null]);

    const results: EventEngagementInfo[] = res.rows.map((row: any) => ({
        eventId: row.eventId,
        likeCount: Number(row.likeCount) || 0,
        likedByViewer: Boolean(row.likedByViewer),
        shareCount: Number(row.shareCount) || 0,
    }));

    // 3. Populate Redis Cache asynchronously
    if (isRedisReady() && results.length > 0) {
        try {
            const pipeline = redis.pipeline();
            for (const item of results) {
                pipeline.set(getLikeCountKey(item.eventId), item.likeCount.toString(), "EX", COUNT_CACHE_TTL);
                pipeline.set(getShareCountKey(item.eventId), item.shareCount.toString(), "EX", COUNT_CACHE_TTL);
                if (isUuidViewer && viewerId) {
                    pipeline.set(getViewerLikeKey(item.eventId, viewerId), item.likedByViewer ? "1" : "0", "EX", VIEWER_CACHE_TTL);
                }
            }
            pipeline.exec().catch(() => {});
        } catch {
            // Ignore pipeline error
        }
    }

    return results;
}

/**
 * Idempotently adds a like to an event by an authenticated user.
 * Guarantees duplicate prevention via PostgreSQL UNIQUE constraint (ON CONFLICT DO NOTHING).
 */
export async function likeEvent(
    eventIdOrSlug: string,
    userId: string
): Promise<EventEngagementInfo> {
    const eventId = await resolveEventId(eventIdOrSlug);
    if (!eventId || !isValidUuid(userId)) {
        throw new Error("Invalid event or user identifier");
    }

    // Atomic insertion: duplicate requests safely ignored
    await query(
        `INSERT INTO club_event_likes (event_id, user_id)
         VALUES ($1::uuid, $2::uuid)
         ON CONFLICT (event_id, user_id) DO NOTHING;`,
        [eventId, userId]
    );

    // Retrieve fresh authoritative counts
    const countsRes = await query(
        `SELECT
            (SELECT COUNT(*)::int FROM club_event_likes WHERE event_id = $1::uuid) AS "likeCount",
            (SELECT COUNT(*)::int FROM club_event_shares WHERE event_id = $1::uuid AND share_type IN ('internal', 'external') AND (account_type IS NULL OR account_type != 'club')) AS "shareCount";`,
        [eventId]
    );

    const likeCount = Number(countsRes.rows[0]?.likeCount) || 0;
    const shareCount = Number(countsRes.rows[0]?.shareCount) || 0;

    // Update Redis cache immediately
    if (isRedisReady()) {
        try {
            const pipeline = redis.pipeline();
            pipeline.set(getLikeCountKey(eventId), likeCount.toString(), "EX", COUNT_CACHE_TTL);
            pipeline.set(getViewerLikeKey(eventId, userId), "1", "EX", VIEWER_CACHE_TTL);
            pipeline.exec().catch(() => {});
        } catch {
            // Safe to ignore
        }
    }

    return {
        eventId,
        likeCount,
        likedByViewer: true,
        shareCount,
    };
}

/**
 * Idempotently removes a like from an event by an authenticated user.
 */
export async function unlikeEvent(
    eventIdOrSlug: string,
    userId: string
): Promise<EventEngagementInfo> {
    const eventId = await resolveEventId(eventIdOrSlug);
    if (!eventId || !isValidUuid(userId)) {
        throw new Error("Invalid event or user identifier");
    }

    // Atomic deletion: removing a non-existent like is a safe no-op
    await query(
        `DELETE FROM club_event_likes
         WHERE event_id = $1::uuid AND user_id = $2::uuid;`,
        [eventId, userId]
    );

    // Retrieve fresh authoritative counts
    const countsRes = await query(
        `SELECT
            (SELECT COUNT(*)::int FROM club_event_likes WHERE event_id = $1::uuid) AS "likeCount",
            (SELECT COUNT(*)::int FROM club_event_shares WHERE event_id = $1::uuid AND share_type IN ('internal', 'external') AND (account_type IS NULL OR account_type != 'club')) AS "shareCount";`,
        [eventId]
    );

    const likeCount = Number(countsRes.rows[0]?.likeCount) || 0;
    const shareCount = Number(countsRes.rows[0]?.shareCount) || 0;

    // Update Redis cache immediately
    if (isRedisReady()) {
        try {
            const pipeline = redis.pipeline();
            pipeline.set(getLikeCountKey(eventId), likeCount.toString(), "EX", COUNT_CACHE_TTL);
            pipeline.set(getViewerLikeKey(eventId, userId), "0", "EX", VIEWER_CACHE_TTL);
            pipeline.exec().catch(() => {});
        } catch {
            // Safe to ignore
        }
    }

    return {
        eventId,
        likeCount,
        likedByViewer: false,
        shareCount,
    };
}

/**
 * Toggles like state for an event.
 */
export async function toggleEventLike(
    eventIdOrSlug: string,
    userId: string
): Promise<EventEngagementInfo> {
    const eventId = await resolveEventId(eventIdOrSlug);
    if (!eventId || !isValidUuid(userId)) {
        throw new Error("Invalid event or user identifier");
    }

    const checkRes = await query(
        `SELECT 1 FROM club_event_likes WHERE event_id = $1::uuid AND user_id = $2::uuid LIMIT 1;`,
        [eventId, userId]
    );

    if (checkRes.rows.length > 0) {
        return unlikeEvent(eventId, userId);
    } else {
        return likeEvent(eventId, userId);
    }
}

/**
 * Verifies whether actor and recipient have an active accepted connection in user_relationships.
 */
export async function areUsersConnected(userId1: string, userId2: string): Promise<boolean> {
    if (!isValidUuid(userId1) || !isValidUuid(userId2)) return false;
    const res = await query(
        `SELECT 1 FROM user_relationships
         WHERE ((user_low_id = $1::uuid AND user_high_id = $2::uuid) OR (user_low_id = $2::uuid AND user_high_id = $1::uuid))
           AND status = 'connected'
         LIMIT 1;`,
        [userId1, userId2]
    );
    return res.rows.length > 0;
}

/**
 * Records an event share action with strict semantic differentiation:
 * 1. 'internal': Internal Orbix peer sharing (persisted message/notification required)
 * 2. 'external': Completed native/external sharing (e.g. Web Share API resolved)
 * 3. 'copy_link': Successful clipboard link copy (tracked separately, NEVER increments public share count)
 *
 * Public share count includes ONLY 'internal' and 'external' shares.
 * Guarantees duplicate prevention via PostgreSQL UNIQUE constraint (event_id, idempotency_key).
 */
export async function recordEventShare(
    optsOrId: string | RecordEventShareOptions,
    idempotencyKeyParam?: string,
    userIdParam?: string | null,
    shareTypeOrPlatformParam?: string,
    recipientUserIdOrRateLimitParam?: string | null,
    maybeRateLimitParam?: string
): Promise<RecordEventShareResult> {
    let eventIdOrSlug: string;
    let idempotencyKey: string;
    let userId: string | null = null;
    let callerAccountType: string | undefined = undefined;
    let shareType: EventShareType = "external";
    let platform = "web_share";
    let recipientUserId: string | null = null;
    let recipientUserIds: string[] | undefined = undefined;
    let customMessage: string | undefined = undefined;
    let rateLimitIdentifier: string | undefined = undefined;

    if (typeof optsOrId === "object" && optsOrId !== null) {
        eventIdOrSlug = optsOrId.eventIdOrSlug;
        idempotencyKey = optsOrId.idempotencyKey;
        userId = optsOrId.userId || null;
        callerAccountType = optsOrId.accountType;
        shareType = optsOrId.shareType || (optsOrId.platform === "clipboard" ? "copy_link" : "external");
        platform = optsOrId.platform || (shareType === "copy_link" ? "clipboard" : shareType === "internal" ? "orbix_peer" : "web_share");
        recipientUserId = optsOrId.recipientUserId || null;
        recipientUserIds = optsOrId.recipientUserIds;
        customMessage = optsOrId.message || optsOrId.note;
        rateLimitIdentifier = optsOrId.rateLimitIdentifier;
    } else {
        eventIdOrSlug = optsOrId;
        idempotencyKey = idempotencyKeyParam || "";
        userId = userIdParam || null;
        const rawTypeOrPlatform = shareTypeOrPlatformParam || "web_share";
        if (rawTypeOrPlatform === "internal" || rawTypeOrPlatform === "copy_link" || rawTypeOrPlatform === "external") {
            shareType = rawTypeOrPlatform;
            platform = shareType === "copy_link" ? "clipboard" : shareType === "internal" ? "orbix_peer" : "web_share";
            recipientUserId = recipientUserIdOrRateLimitParam || null;
            rateLimitIdentifier = maybeRateLimitParam;
        } else if (rawTypeOrPlatform === "clipboard") {
            shareType = "copy_link";
            platform = "clipboard";
            rateLimitIdentifier = recipientUserIdOrRateLimitParam || undefined;
        } else {
            shareType = "external";
            platform = rawTypeOrPlatform;
            rateLimitIdentifier = recipientUserIdOrRateLimitParam || undefined;
        }
    }

    const eventId = await resolveEventId(eventIdOrSlug);
    if (!eventId) {
        throw new Error("Event not found");
    }

    // Verify event exists and is eligible for sharing
    const eventCheck = await query(
        `SELECT id, title, slug, status FROM club_events WHERE id = $1::uuid;`,
        [eventId]
    );
    if (eventCheck.rows.length === 0) {
        throw new Error("Event not found");
    }
    const eventRow = eventCheck.rows[0];
    if (eventRow.status === "cancelled") {
        throw new Error("Cancelled events cannot be shared");
    }
    const eventTitle = eventRow.title || "Campus Event";
    const eventSlug = eventRow.slug || "";

    const cleanKey = String(idempotencyKey || "").trim();
    if (!cleanKey || cleanKey.length < 8 || cleanKey.length > 128) {
        throw new Error("Invalid share idempotency key");
    }

    const isUuidUser = isValidUuid(userId);
    let resolvedAccountType = "personal";

    if (isUuidUser && userId) {
        const userRes = await query(`SELECT account_type FROM users WHERE id = $1::uuid LIMIT 1;`, [userId]);
        if (userRes.rows.length > 0) {
            resolvedAccountType = userRes.rows[0].account_type === "club" ? "club" : "personal";
        }
    }
    if (callerAccountType === "club") {
        resolvedAccountType = "club";
    }

    // Strict account-type enforcement: club accounts are restricted to external sharing only
    if (resolvedAccountType === "club" && shareType === "internal") {
        throw new Error("Club accounts are restricted to external sharing only");
    }

    // Rate limiting check
    const rKey = rateLimitIdentifier || userId || "anonymous";
    if (isRedisReady()) {
        try {
            const limitKey = getShareRateLimitKey(rKey);
            const currentHits = await redis.incr(limitKey);
            if (currentHits === 1) {
                await redis.expire(limitKey, RATE_LIMIT_WINDOW_SECS);
            }
            if (currentHits > MAX_SHARES_PER_WINDOW) {
                const countRes = await query(
                    `SELECT
                        (COUNT(*) FILTER (WHERE share_type IN ('internal', 'external') AND (account_type IS NULL OR account_type != 'club')))::int AS public_shares,
                        (COUNT(*) FILTER (WHERE share_type = 'internal'))::int AS internal_shares,
                        (COUNT(*) FILTER (WHERE share_type = 'external'))::int AS external_shares,
                        (COUNT(*) FILTER (WHERE share_type = 'copy_link'))::int AS link_copies
                     FROM club_event_shares WHERE event_id = $1::uuid;`,
                    [eventId]
                );
                const countRow = countRes.rows[0] || {};
                const currentPublicCount = Number(countRow.public_shares) || 0;
                return {
                    eventId,
                    shareCount: currentPublicCount,
                    shareType,
                    platform,
                    recipientUserId,
                    successfulDeliveries: 0,
                    failedDeliveries: 0,
                    counts: {
                        publicShares: currentPublicCount,
                        internalShares: Number(countRow.internal_shares) || 0,
                        externalShares: Number(countRow.external_shares) || 0,
                        linkCopies: Number(countRow.link_copies) || 0,
                    },
                };
            }
        } catch {
            // Fails open if Redis rate limit check errors
        }
    }

    // 1. Internal Orbix Sharing Validation & Message Persistence
    if (shareType === "internal") {
        if (!isUuidUser || !userId) {
            throw new Error("Authentication required for internal Orbix sharing");
        }

        const recipientsList: string[] = [];
        if (Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
            for (const r of recipientUserIds) {
                const s = String(r || "").trim();
                if (s && !recipientsList.includes(s)) recipientsList.push(s);
            }
        }
        if (recipientsList.length === 0 && recipientUserId) {
            const s = String(recipientUserId).trim();
            if (s) recipientsList.push(s);
        }

        if (recipientsList.length === 0) {
            throw new Error("At least one recipient user ID required for internal sharing");
        }

        const deliveryOutcomes: RecipientShareOutcome[] = [];
        let successfulDeliveries = 0;
        let failedDeliveries = 0;

        for (const targetId of recipientsList) {
            if (!isValidUuid(targetId)) {
                deliveryOutcomes.push({ recipientUserId: targetId, success: false, error: "Invalid recipient user ID" });
                failedDeliveries++;
                continue;
            }

            if (targetId.toLowerCase() === userId.toLowerCase()) {
                deliveryOutcomes.push({ recipientUserId: targetId, success: false, error: "Cannot share an event with yourself" });
                failedDeliveries++;
                continue;
            }

            // Connection eligibility validation: verify connection exists in user_relationships
            const isConnected = await areUsersConnected(userId, targetId);
            if (!isConnected) {
                deliveryOutcomes.push({ recipientUserId: targetId, success: false, error: "Recipient is not a connected peer" });
                failedDeliveries++;
                continue;
            }

            // Persist message via dispatchNotification
            const itemKey = recipientsList.length > 1 ? `${cleanKey}-${targetId.slice(0, 8)}` : cleanKey;
            const notifResult = await dispatchNotification({
                recipientId: targetId,
                actorId: userId,
                title: `Event Shared: ${eventTitle}`,
                body: customMessage
                    ? `${customMessage}\n\nShared the event "${eventTitle}" with you.`
                    : `Shared the event "${eventTitle}" with you.`,
                notificationType: "event_share",
                metadata: {
                    eventId,
                    eventTitle,
                    eventSlug,
                    shareType: "internal",
                    note: customMessage || null,
                    url: `/college-events?event=${encodeURIComponent(eventId)}`,
                    idempotencyKey: itemKey,
                },
                idempotencyKey: `event-share-${eventId}-${itemKey}`,
                isUserInitiated: true,
            });

            if (!notifResult.success) {
                deliveryOutcomes.push({ recipientUserId: targetId, success: false, error: notifResult.error || "Failed to deliver message" });
                failedDeliveries++;
                continue;
            }

            // Record internal share ONLY after message persistence succeeds.
            // PostgreSQL partial unique index enforces: exactly 1 counted internal share per (event_id, user_id, recipient_user_id).
            // On conflict (unique internal share already exists, or request idempotency hit), DO NOTHING.
            // Delivery was successful, counting is an idempotent no-op.
            const insertShareRes = await query(
                `INSERT INTO club_event_shares (event_id, user_id, idempotency_key, share_type, platform, recipient_user_id, account_type)
                 VALUES ($1::uuid, $2::uuid, $3, 'internal', $4, $5::uuid, $6)
                 ON CONFLICT DO NOTHING
                 RETURNING id;`,
                [eventId, userId, itemKey, platform.slice(0, 50), targetId, resolvedAccountType]
            );

            successfulDeliveries++;
            const isNewCount = insertShareRes.rows.length > 0;
            deliveryOutcomes.push({ recipientUserId: targetId, success: true, isNewCount });
        }

        // If all selected recipients failed, throw the first error
        if (recipientsList.length > 0 && successfulDeliveries === 0) {
            const firstErr = deliveryOutcomes[0]?.error || "Failed to share event internally";
            throw new Error(firstErr);
        }

        // Retrieve authoritative counts
        const countRes = await query(
            `SELECT
                (COUNT(*) FILTER (WHERE share_type IN ('internal', 'external') AND (account_type IS NULL OR account_type != 'club')))::int AS public_shares,
                (COUNT(*) FILTER (WHERE share_type = 'internal'))::int AS internal_shares,
                (COUNT(*) FILTER (WHERE share_type = 'external'))::int AS external_shares,
                (COUNT(*) FILTER (WHERE share_type = 'copy_link'))::int AS link_copies
             FROM club_event_shares
             WHERE event_id = $1::uuid;`,
            [eventId]
        );

        const countRow = countRes.rows[0] || {};
        const publicShareCount = Number(countRow.public_shares) || 0;

        if (isRedisReady()) {
            try {
                await redis.set(getShareCountKey(eventId), publicShareCount.toString(), "EX", COUNT_CACHE_TTL);
            } catch {}
        }

        return {
            eventId,
            shareCount: publicShareCount,
            shareType,
            platform,
            recipientUserId: recipientsList.length === 1 ? recipientsList[0] : null,
            recipientUserIds: recipientsList,
            successfulDeliveries,
            failedDeliveries,
            deliveryOutcomes,
            counts: {
                publicShares: publicShareCount,
                internalShares: Number(countRow.internal_shares) || 0,
                externalShares: Number(countRow.external_shares) || 0,
                linkCopies: Number(countRow.link_copies) || 0,
            },
        };
    }

    // 2. External and Copy-Link Sharing
    await query(
        `INSERT INTO club_event_shares (event_id, user_id, idempotency_key, share_type, platform, recipient_user_id, account_type)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, NULL, $6)
         ON CONFLICT (event_id, idempotency_key) DO NOTHING;`,
        [
            eventId,
            isUuidUser ? userId : null,
            cleanKey,
            shareType,
            platform.slice(0, 50),
            resolvedAccountType,
        ]
    );

    // 3. Retrieve authoritative counts (public share count EXCLUDES 'copy_link' and club accounts)
    const countRes = await query(
        `SELECT
            (COUNT(*) FILTER (WHERE share_type IN ('internal', 'external') AND (account_type IS NULL OR account_type != 'club')))::int AS public_shares,
            (COUNT(*) FILTER (WHERE share_type = 'internal'))::int AS internal_shares,
            (COUNT(*) FILTER (WHERE share_type = 'external'))::int AS external_shares,
            (COUNT(*) FILTER (WHERE share_type = 'copy_link'))::int AS link_copies
         FROM club_event_shares
         WHERE event_id = $1::uuid;`,
        [eventId]
    );

    const countRow = countRes.rows[0] || {};
    const publicShareCount = Number(countRow.public_shares) || 0;

    // 4. Update Redis cache immediately with authoritative public share count
    if (isRedisReady()) {
        try {
            await redis.set(getShareCountKey(eventId), publicShareCount.toString(), "EX", COUNT_CACHE_TTL);
        } catch {
            // Safe to ignore if Redis fails; PostgreSQL remains authoritative
        }
    }

    return {
        eventId,
        shareCount: publicShareCount,
        shareType,
        platform,
        recipientUserId: null,
        successfulDeliveries: 1,
        counts: {
            publicShares: publicShareCount,
            internalShares: Number(countRow.internal_shares) || 0,
            externalShares: Number(countRow.external_shares) || 0,
            linkCopies: Number(countRow.link_copies) || 0,
        },
    };
}
