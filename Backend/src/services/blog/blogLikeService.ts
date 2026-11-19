// Backend/src/services/blog/blogLikeService.ts
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";

export interface PublicationLikeInfo {
    hoster: string;
    blogName: string;
    likeCount: number;
    likedByViewer: boolean;
}

export interface PublicationKey {
    hoster: string;
    blogName: string;
}

const COUNT_CACHE_TTL = 3600; // 1 hour
const VIEWER_CACHE_TTL = 300; // 5 minutes

/**
 * Checks whether Redis is ready to accept commands.
 */
function isRedisReady(): boolean {
    return Boolean(redis && redis.status === "ready");
}

/**
 * Generates standardized Redis cache keys.
 */
function getCountCacheKey(cleanHoster: string, cleanBlogName: string): string {
    return `blog:likes:count:${cleanHoster}:${cleanBlogName}`;
}

function getViewerCacheKey(cleanHoster: string, cleanBlogName: string, viewerId: string): string {
    return `blog:likes:viewer:${cleanHoster}:${cleanBlogName}:${viewerId}`;
}

/**
 * Safely retrieves cached count from Redis with non-blocking error handling.
 */
async function getCachedCount(cleanHoster: string, cleanBlogName: string): Promise<number | null> {
    if (!isRedisReady()) return null;
    try {
        const val = await redis.get(getCountCacheKey(cleanHoster, cleanBlogName));
        if (val !== null && val !== undefined) {
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? null : parsed;
        }
    } catch {
        // Silently fall back to database
    }
    return null;
}

/**
 * Safely persists aggregate count to Redis with non-blocking error handling.
 */
async function setCachedCount(cleanHoster: string, cleanBlogName: string, count: number): Promise<void> {
    if (!isRedisReady()) return;
    try {
        await redis.set(getCountCacheKey(cleanHoster, cleanBlogName), count.toString(), "EX", COUNT_CACHE_TTL);
    } catch {
        // Safe to ignore
    }
}

/**
 * Safely retrieves cached viewer liked status from Redis.
 */
async function getCachedViewerState(cleanHoster: string, cleanBlogName: string, viewerId: string): Promise<boolean | null> {
    if (!isRedisReady()) return null;
    try {
        const val = await redis.get(getViewerCacheKey(cleanHoster, cleanBlogName, viewerId));
        if (val === "1") return true;
        if (val === "0") return false;
    } catch {
        // Silently fall back to database
    }
    return null;
}

/**
 * Safely persists viewer liked status to Redis.
 */
async function setCachedViewerState(cleanHoster: string, cleanBlogName: string, viewerId: string, liked: boolean): Promise<void> {
    if (!isRedisReady()) return;
    try {
        await redis.set(getViewerCacheKey(cleanHoster, cleanBlogName, viewerId), liked ? "1" : "0", "EX", VIEWER_CACHE_TTL);
    } catch {
        // Safe to ignore
    }
}

/**
 * Explicitly invalidates Redis cache for a publication.
 * Useful when administrative operations, direct DB modifications, or account cascades occur.
 */
export async function invalidatePublicationLikeCache(hoster: string, blogName: string): Promise<void> {
    const { cleanHoster, cleanBlogName } = normalizePublicationKey(hoster, blogName);
    if (!isRedisReady()) return;
    try {
        await redis.del(getCountCacheKey(cleanHoster, cleanBlogName));
    } catch {
        // Safe to ignore
    }
}

/**
 * Normalizes string inputs for case-insensitive matching while preserving clean format.
 */
export function normalizePublicationKey(hoster: string, blogName: string): { cleanHoster: string; cleanBlogName: string } {
    const cleanHoster = String(hoster || "").trim().toLowerCase();
    const cleanBlogName = String(blogName || "").trim().toLowerCase();
    return { cleanHoster, cleanBlogName };
}

/**
 * Retrieves like count and viewer state for a single publication.
 * Accessible to guests (viewerId = null -> likedByViewer = false) and authenticated users.
 * Leverages Redis cache-first lookup with PostgreSQL as authoritative fallback.
 */
export async function getPublicationLikeInfo(
    hoster: string,
    blogName: string,
    viewerId?: string | null
): Promise<PublicationLikeInfo> {
    const { cleanHoster, cleanBlogName } = normalizePublicationKey(hoster, blogName);

    if (!cleanHoster || !cleanBlogName) {
        return {
            hoster: hoster || "",
            blogName: blogName || "",
            likeCount: 0,
            likedByViewer: false,
        };
    }

    const isUuid = viewerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(viewerId);

    // 1. Check Redis Cache
    if (isRedisReady()) {
        try {
            const cachedCount = await getCachedCount(cleanHoster, cleanBlogName);
            if (cachedCount !== null) {
                // If viewer is guest (or invalid UUID), viewer is never liked
                if (!isUuid || !viewerId) {
                    return {
                        hoster,
                        blogName,
                        likeCount: cachedCount,
                        likedByViewer: false,
                    };
                }

                // For authenticated viewers, check cached viewer state
                const cachedViewer = await getCachedViewerState(cleanHoster, cleanBlogName, viewerId);
                if (cachedViewer !== null) {
                    return {
                        hoster,
                        blogName,
                        likeCount: cachedCount,
                        likedByViewer: cachedViewer,
                    };
                }
            }
        } catch {
            // Fall through to PostgreSQL on any Redis issue
        }
    }

    // 2. Query Authoritative PostgreSQL Database
    const sql = `
        SELECT
            (SELECT COUNT(*)::int FROM blog_likes WHERE LOWER(hoster) = $1 AND LOWER(blog_name) = $2) AS "likeCount",
            CASE
                WHEN $3::uuid IS NOT NULL THEN
                    EXISTS(SELECT 1 FROM blog_likes WHERE LOWER(hoster) = $1 AND LOWER(blog_name) = $2 AND user_id = $3::uuid)
                ELSE false
            END AS "likedByViewer";
    `;

    const res = await query(sql, [cleanHoster, cleanBlogName, isUuid ? viewerId : null]);
    const row = res.rows[0];

    const likeCount = row ? Number(row.likeCount) || 0 : 0;
    const likedByViewer = Boolean(row?.likedByViewer);

    // 3. Populate Redis Cache asynchronously
    if (isRedisReady()) {
        setCachedCount(cleanHoster, cleanBlogName, likeCount).catch(() => {});
        if (isUuid && viewerId) {
            setCachedViewerState(cleanHoster, cleanBlogName, viewerId, likedByViewer).catch(() => {});
        }
    }

    return {
        hoster,
        blogName,
        likeCount,
        likedByViewer,
    };
}

/**
 * Retrieves like information for a batch of publications.
 * Avoids N+1 queries by leveraging Redis cache and PostgreSQL jsonb_to_recordset.
 */
export async function getBatchPublicationLikes(
    items: PublicationKey[],
    viewerId?: string | null
): Promise<PublicationLikeInfo[]> {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    // Deduplicate items by composite key
    const seen = new Set<string>();
    const deduplicated: PublicationKey[] = [];

    for (const item of items) {
        const { cleanHoster, cleanBlogName } = normalizePublicationKey(item?.hoster, item?.blogName);
        if (!cleanHoster || !cleanBlogName) continue;
        const key = `${cleanHoster}::${cleanBlogName}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push({
                hoster: String(item.hoster).trim(),
                blogName: String(item.blogName).trim(),
            });
        }
    }

    if (deduplicated.length === 0) {
        return [];
    }

    // Enforce max batch size of 50
    const limited = deduplicated.slice(0, 50);

    const isUuid = viewerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(viewerId);

    // Try Redis cache for the batch
    if (isRedisReady()) {
        try {
            const countKeys = limited.map((p) => {
                const { cleanHoster, cleanBlogName } = normalizePublicationKey(p.hoster, p.blogName);
                return getCountCacheKey(cleanHoster, cleanBlogName);
            });
            const cachedCounts = await redis.mget(...countKeys);

            // If all counts are cached and viewer is a guest, fulfill entirely from cache
            if (!isUuid || !viewerId) {
                const allCached = cachedCounts.every((c) => c !== null && c !== undefined);
                if (allCached) {
                    return limited.map((p, idx) => ({
                        hoster: p.hoster,
                        blogName: p.blogName,
                        likeCount: parseInt(cachedCounts[idx] || "0", 10) || 0,
                        likedByViewer: false,
                    }));
                }
            }
        } catch {
            // Fall through to PostgreSQL
        }
    }

    const jsonParam = JSON.stringify(
        limited.map((p) => ({
            hoster: p.hoster,
            blog_name: p.blogName,
        }))
    );

    const sql = `
        WITH requested AS (
            SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(hoster varchar, blog_name varchar)
        ),
        counts AS (
            SELECT LOWER(b.hoster) AS hoster, LOWER(b.blog_name) AS blog_name, COUNT(*)::int AS like_count
            FROM blog_likes b
            JOIN requested r ON LOWER(b.hoster) = LOWER(r.hoster) AND LOWER(b.blog_name) = LOWER(r.blog_name)
            GROUP BY LOWER(b.hoster), LOWER(b.blog_name)
        ),
        viewer AS (
            SELECT LOWER(b.hoster) AS hoster, LOWER(b.blog_name) AS blog_name, true AS liked
            FROM blog_likes b
            JOIN requested r ON LOWER(b.hoster) = LOWER(r.hoster) AND LOWER(b.blog_name) = LOWER(r.blog_name)
            WHERE ($2::uuid IS NOT NULL AND b.user_id = $2::uuid)
        )
        SELECT 
            r.hoster,
            r.blog_name AS "blogName",
            COALESCE(c.like_count, 0)::int AS "likeCount",
            COALESCE(v.liked, false) AS "likedByViewer"
        FROM requested r
        LEFT JOIN counts c ON LOWER(r.hoster) = c.hoster AND LOWER(r.blog_name) = c.blog_name
        LEFT JOIN viewer v ON LOWER(r.hoster) = v.hoster AND LOWER(r.blog_name) = v.blog_name;
    `;

    const res = await query(sql, [jsonParam, isUuid ? viewerId : null]);

    const results: PublicationLikeInfo[] = res.rows.map((row: any) => ({
        hoster: row.hoster,
        blogName: row.blogName,
        likeCount: Number(row.likeCount) || 0,
        likedByViewer: Boolean(row.likedByViewer),
    }));

    // Cache results in Redis asynchronously
    if (isRedisReady()) {
        try {
            const pipeline = redis.pipeline();
            for (const item of results) {
                const { cleanHoster, cleanBlogName } = normalizePublicationKey(item.hoster, item.blogName);
                pipeline.set(getCountCacheKey(cleanHoster, cleanBlogName), item.likeCount.toString(), "EX", COUNT_CACHE_TTL);
                if (isUuid && viewerId) {
                    pipeline.set(getViewerCacheKey(cleanHoster, cleanBlogName, viewerId), item.likedByViewer ? "1" : "0", "EX", VIEWER_CACHE_TTL);
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
 * Idempotently creates a like for a publication by an authenticated user.
 * Guarantees duplicate prevention via PostgreSQL UNIQUE constraint (ON CONFLICT DO NOTHING).
 * Updates Redis cache immediately with authoritative count and viewer state.
 */
export async function likePublication(
    hoster: string,
    blogName: string,
    userId: string
): Promise<PublicationLikeInfo> {
    const { cleanHoster, cleanBlogName } = normalizePublicationKey(hoster, blogName);

    if (!cleanHoster || !cleanBlogName || !userId) {
        throw new Error("Invalid publication or user identifier");
    }

    // Atomic insertion: duplicate requests safely ignored
    await query(
        `INSERT INTO blog_likes (hoster, blog_name, user_id)
         VALUES ($1, $2, $3::uuid)
         ON CONFLICT (hoster, blog_name, user_id) DO NOTHING;`,
        [cleanHoster, cleanBlogName, userId]
    );

    // Retrieve fresh authoritative count
    const countRes = await query(
        `SELECT COUNT(*)::int AS count FROM blog_likes WHERE LOWER(hoster) = $1 AND LOWER(blog_name) = $2;`,
        [cleanHoster, cleanBlogName]
    );

    const likeCount = Number(countRes.rows[0]?.count) || 0;

    // Update Redis cache immediately
    if (isRedisReady()) {
        setCachedCount(cleanHoster, cleanBlogName, likeCount).catch(() => {});
        setCachedViewerState(cleanHoster, cleanBlogName, userId, true).catch(() => {});
    }

    return {
        hoster,
        blogName,
        likeCount,
        likedByViewer: true,
    };
}

/**
 * Idempotently removes a like for a publication by an authenticated user.
 * Repeated calls on an unliked publication are safely idempotent.
 * Updates Redis cache immediately with authoritative count and viewer state.
 */
export async function unlikePublication(
    hoster: string,
    blogName: string,
    userId: string
): Promise<PublicationLikeInfo> {
    const { cleanHoster, cleanBlogName } = normalizePublicationKey(hoster, blogName);

    if (!cleanHoster || !cleanBlogName || !userId) {
        throw new Error("Invalid publication or user identifier");
    }

    // Atomic deletion: removing a non-existent like is a safe no-op
    await query(
        `DELETE FROM blog_likes
         WHERE LOWER(hoster) = $1 AND LOWER(blog_name) = $2 AND user_id = $3::uuid;`,
        [cleanHoster, cleanBlogName, userId]
    );

    // Retrieve fresh authoritative count
    const countRes = await query(
        `SELECT COUNT(*)::int AS count FROM blog_likes WHERE LOWER(hoster) = $1 AND LOWER(blog_name) = $2;`,
        [cleanHoster, cleanBlogName]
    );

    const likeCount = Number(countRes.rows[0]?.count) || 0;

    // Update Redis cache immediately
    if (isRedisReady()) {
        setCachedCount(cleanHoster, cleanBlogName, likeCount).catch(() => {});
        setCachedViewerState(cleanHoster, cleanBlogName, userId, false).catch(() => {});
    }

    return {
        hoster,
        blogName,
        likeCount,
        likedByViewer: false,
    };
}
