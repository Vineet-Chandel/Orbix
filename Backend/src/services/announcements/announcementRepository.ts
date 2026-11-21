import { pool, query } from '../../database/client.js';
import type { PoolClient } from 'pg';
import { AnnouncementError, adminSql, encodeCursor, membershipSql, visibilitySql } from './announcementPolicy.js';
import type { RichNode } from '../../../../shared/announcements.js';

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0;
    while (true) {
        let client: PoolClient | null = null;
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (error: any) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch {}
            }
            attempt++;
            const msg = String(error?.message || '').toLowerCase();
            const isTransient = msg.includes('timeout') || msg.includes('connection terminated') || msg.includes('connection reset');
            if (attempt <= maxRetries && isTransient) {
                await new Promise(r => setTimeout(r, attempt * 500));
                continue;
            }
            throw error;
        } finally {
            if (client) client.release();
        }
    }
}
export async function rateLimit(userId: string, action: string, maximum: number, seconds = 60) {
    const bucket = Math.floor(Date.now() / (seconds * 1000));
    const result = await query(`INSERT INTO club_announcement_limits(actor_id, action, bucket) VALUES($1,$2,$3)
        ON CONFLICT(actor_id, action, bucket) DO UPDATE SET attempts=club_announcement_limits.attempts+1 RETURNING attempts`, [userId, action, bucket]);
    if (result.rows[0].attempts > maximum) {
        const retryAfter = seconds - (Math.floor(Date.now() / 1000) % seconds);
        const error = new AnnouncementError(429, `Too many requests. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
        error.retryAfter = retryAfter;
        throw error;
    }
}
export async function getClubs(userId: string) {
    const result = await query(`SELECT c.id, c.name, c.slug, c.logo_url AS "logoUrl", c.college_id AS "collegeId", c.visibility, c.publication_status AS "publicationStatus", c.profile_visibility AS "profileVisibility",
        ${adminSql()} AS "isAdmin" FROM verified_clubs c WHERE c.is_active AND ${membershipSql()} ORDER BY c.name, c.id`, [userId]);
    return result.rows;
}
export async function requireClub(userId: string, clubId: string) {
    const result = await query(`SELECT c.id, c.name, c.slug, c.college_id AS "collegeId", ${adminSql()} AS "isAdmin"
        FROM verified_clubs c WHERE c.id=$2 AND c.is_active AND ${membershipSql()}`, [userId, clubId]);
    if (!result.rows[0]) throw new AnnouncementError(403, 'Active club membership is required.');
    return result.rows[0];
}
export async function requireAnnouncement(userId: string, id: string, client?: Pick<PoolClient, 'query'>, lock = false) {
    const runner = client || { query };
    const result = await runner.query(`SELECT a.*, ${membershipSql()} AS "isMember", (a.author_id=$1 OR ${adminSql()}) AS "canManage"
        FROM club_announcements a JOIN verified_clubs c ON c.id=a.club_id
        WHERE a.id=$2 AND a.deleted_at IS NULL AND c.is_active AND ${visibilitySql()} ${lock ? 'FOR UPDATE OF a' : ''}`, [userId, id]);
    if (!result.rows[0]) throw new AnnouncementError(404, 'Announcement is unavailable or you do not have access.');
    return result.rows[0];
}
const fields = `a.id, a.club_id AS "clubId", a.author_id AS "authorId", a.content, a.plain_text AS "plainText", a.status,
    a.created_at AS "createdAt", a.created_at::text AS "cursorTime", a.updated_at AS "updatedAt",
    c.name AS "clubName", c.slug AS "clubSlug", c.logo_url AS "clubLogo",
    (${membershipSql()} AND (a.author_id=$1 OR ${adminSql()})) AS "canManage",
    (SELECT COUNT(*)::int FROM club_announcement_likes l WHERE l.announcement_id=a.id) AS "likeCount",
    EXISTS (SELECT 1 FROM club_announcement_likes l WHERE l.announcement_id=a.id AND l.user_id=$1) AS liked`;
export async function fetchPage(userId: string, club: { id: string; collegeId: string | null }, scope: string, limit: number, cursor: { time: string; id: string } | null) {
    const values: unknown[] = [userId, scope === 'campus' ? club.collegeId : club.id, limit + 1];
    let condition = scope === 'campus' ? `a.status='published' AND (c.college_id=$2 OR c.id=$4)` : `c.id=$2`;
    if (scope === 'campus') values.push(club.id);
    if (cursor) {
        values.push(cursor.time, cursor.id);
        condition += ` AND (a.created_at,a.id) < ($${values.length - 1}::timestamptz,$${values.length}::uuid)`;
    }
    const result = await query(`SELECT ${fields} FROM club_announcements a JOIN verified_clubs c ON c.id=a.club_id
        WHERE a.deleted_at IS NULL AND c.is_active AND ${visibilitySql()} AND ${condition}
        ORDER BY a.created_at DESC, a.id DESC LIMIT $3`, values);
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    const last = rows[rows.length - 1];
    return { rows, pagination: { hasMore, nextCursor: hasMore && last ? encodeCursor(last.cursorTime, last.id) : null } };
}
export async function fetchOne(userId: string, id: string) {
    const result = await query(`SELECT ${fields} FROM club_announcements a JOIN verified_clubs c ON c.id=a.club_id
        WHERE a.id=$2 AND a.deleted_at IS NULL AND c.is_active AND ${visibilitySql()}`, [userId, id]);
    if (!result.rows[0]) throw new AnnouncementError(404, 'Announcement is unavailable or you do not have access.');
    return result.rows[0];
}
export async function assetsFor(ids: string[]) {
    if (!ids.length) return [];
    return (await query(`SELECT * FROM club_announcement_assets WHERE announcement_id=ANY($1::uuid[]) AND state='attached' ORDER BY display_order,id`, [ids])).rows;
}
export async function attachAssets(client: PoolClient, userId: string, clubId: string, announcementId: string, assetIds: string[]) {
    const result = await client.query(`SELECT id, uploader_id, announcement_id, state, expires_at>NOW() AS unexpired, finalize_until>NOW() AS uncancelled FROM club_announcement_assets
        WHERE club_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE`, [clubId, assetIds]);
    if (result.rows.length !== assetIds.length || result.rows.some(a =>
        !(a.state === 'attached' && a.announcement_id === announcementId) && !(a.state === 'verified' && a.unexpired && a.uncancelled && a.uploader_id === userId && !a.announcement_id))) {
        throw new AnnouncementError(400, 'One or more uploads are unavailable, unverified, or belong to another publisher.');
    }
    await client.query(`UPDATE club_announcement_assets SET announcement_id=NULL, state='verified', expires_at=NOW()+INTERVAL '70 minutes'
        WHERE announcement_id=$1 AND NOT (id=ANY($2::uuid[]))`, [announcementId, assetIds]);
    if (assetIds.length) await client.query(`UPDATE club_announcement_assets a SET announcement_id=$1, state='attached', display_order=ordered.ordinality-1
        FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id,ordinality) WHERE a.id=ordered.id`, [announcementId, assetIds]);
}
export async function audit(client: PoolClient, announcementId: string, actorId: string, action: string) {
    await client.query('INSERT INTO club_announcement_audit(announcement_id,actor_id,action) VALUES($1,$2,$3)', [announcementId, actorId, action]);
}
export async function writeAnnouncement(userId: string, clubId: string, requestId: string, input: { content: RichNode; plainText: string; assetIds: string[]; status: string }, id?: string) {
    return transaction(async client => {
        let announcementId = id;
        if (id) {
            const existing = await requireAnnouncement(userId, id, client, true);
            if (!existing.isMember || !existing.canManage || existing.club_id !== clubId) throw new AnnouncementError(403, 'Only the author or a club administrator can manage this announcement.');
            await client.query('UPDATE club_announcements SET content=$2, plain_text=$3, status=$4, updated_at=NOW() WHERE id=$1', [id, JSON.stringify(input.content), input.plainText, input.status]);
        } else {
            const result = await client.query(`INSERT INTO club_announcements(club_id,author_id,content,plain_text,status,client_request_id)
                VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(author_id,client_request_id) DO NOTHING RETURNING id`,
                [clubId, userId, JSON.stringify(input.content), input.plainText, input.status, requestId]);
            if (!result.rows[0]) {
                const prior = await client.query('SELECT id,club_id,deleted_at FROM club_announcements WHERE author_id=$1 AND client_request_id=$2', [userId, requestId]);
                if (prior.rows[0]?.club_id !== clubId || prior.rows[0]?.deleted_at) throw new AnnouncementError(409, 'This submission has already been used. Refresh the composer.');
                return prior.rows[0].id as string;
            }
            announcementId = result.rows[0].id;
        }
        await attachAssets(client, userId, clubId, announcementId!, input.assetIds);
        await audit(client, announcementId!, userId, id ? 'updated' : 'created');
        if (input.status === 'published') await client.query('INSERT INTO club_announcement_jobs(announcement_id) VALUES($1) ON CONFLICT DO NOTHING', [announcementId]);
        return announcementId!;
    });
}
export async function removeAnnouncement(userId: string, id: string) {
    return transaction(async client => {
        const existing = await requireAnnouncement(userId, id, client, true);
        if (!existing.isMember || !existing.canManage) throw new AnnouncementError(403, 'Only the author or a club administrator can delete this announcement.');
        await client.query('UPDATE club_announcements SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [id]);
        await client.query(`UPDATE club_announcement_assets SET announcement_id=NULL,state='verified',expires_at=NOW()+INTERVAL '70 minutes' WHERE announcement_id=$1`, [id]);
        await audit(client, id, userId, 'deleted');
    });
}
export async function setLike(userId: string, id: string, liked: boolean) {
    return transaction(async client => {
        // Serialize engagement against deletion and other likes on this announcement.
        const item = await requireAnnouncement(userId, id, client, true);
        if (item.status !== 'published') throw new AnnouncementError(409, 'Only published announcements can be liked.');
        if (liked) await client.query('INSERT INTO club_announcement_likes(announcement_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
        else await client.query('DELETE FROM club_announcement_likes WHERE announcement_id=$1 AND user_id=$2', [id, userId]);
        const count = await client.query('SELECT COUNT(*)::int AS count FROM club_announcement_likes WHERE announcement_id=$1', [id]);
        return { liked, likeCount: count.rows[0].count };
    });
}
