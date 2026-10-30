// Backend/src/services/blog/blogLikeService.ts
import { query } from "../../database/client.js";

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

    return {
        hoster,
        blogName,
        likeCount: row ? Number(row.likeCount) || 0 : 0,
        likedByViewer: Boolean(row?.likedByViewer),
    };
}

/**
 * Retrieves like information for a batch of publications in a single database query.
 * Avoids N+1 queries by leveraging jsonb_to_recordset and grouped relational joins.
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
    const jsonParam = JSON.stringify(
        limited.map((p) => ({
            hoster: p.hoster,
            blog_name: p.blogName,
        }))
    );

    const isUuid = viewerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(viewerId);

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

    return res.rows.map((row: any) => ({
        hoster: row.hoster,
        blogName: row.blogName,
        likeCount: Number(row.likeCount) || 0,
        likedByViewer: Boolean(row.likedByViewer),
    }));
}

/**
 * Idempotently creates a like for a publication by an authenticated user.
 * Guarantees duplicate prevention via PostgreSQL UNIQUE constraint (ON CONFLICT DO NOTHING).
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

    return {
        hoster,
        blogName,
        likeCount,
        likedByViewer: false,
    };
}

