import { MAX_ATTACHMENTS, validateDocument } from '../../../../shared/announcements.js';
export class AnnouncementError extends Error {
    retryAfter = 60;
    constructor(public status: number, message: string) { super(message); }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireId(value: unknown): string {
    if (typeof value !== 'string' || !UUID.test(value)) throw new AnnouncementError(400, 'Invalid identifier.');
    return value;
}
export function parseCursor(value: unknown): { time: string; id: string } | null {
    if (value === undefined || value === '') return null;
    try {
        if (typeof value !== 'string' || value.length > 300) throw new Error();
        const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        requireId(parsed.id);
        // Preserve PostgreSQL microseconds; converting through JS Date loses cursor precision.
        if (typeof parsed.time !== 'string' || !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(parsed.time) || !Number.isFinite(Date.parse(parsed.time))) throw new Error();
        return { time: parsed.time, id: parsed.id };
    } catch { throw new AnnouncementError(400, 'Invalid pagination cursor. Refresh the feed.'); }
}
export function encodeCursor(time: string, id: string) { return Buffer.from(JSON.stringify({ time, id })).toString('base64url'); }
export function pageLimit(value: unknown) {
    if (value === undefined) return 10;
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new AnnouncementError(400, 'Page size must be between 1 and 30.');
    return limit;
}
export function validatePublication(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AnnouncementError(400, 'Announcement content is required.');
    const data = value as Record<string, unknown>;
    try {
        const document = validateDocument(data.content);
        if (!Array.isArray(data.assetIds) || data.assetIds.length > MAX_ATTACHMENTS || new Set(data.assetIds).size !== data.assetIds.length) throw new Error('Attach up to eight unique files.');
        const assetIds = data.assetIds.map(requireId);
        if (!document.plainText && !assetIds.length) throw new Error('Write a message or attach a file before publishing.');
        const status = data.status ?? 'published';
        if (!['draft', 'published', 'archived'].includes(String(status))) throw new Error('Invalid publication status.');
        return { ...document, assetIds, status: status as 'draft' | 'published' | 'archived' };
    } catch (error) { throw new AnnouncementError(400, (error as Error).message); }
}
// The same active-membership policy is used for feeds, uploads and every mutation.
export function membershipSql(club = 'c', user = '$1') {
    return `(${club}.auth_user_id = ${user}
        OR EXISTS (SELECT 1 FROM club_memberships cm WHERE cm.club_id=${club}.id AND cm.user_id=${user} AND cm.status='active')
        OR EXISTS (SELECT 1 FROM club_team_members tm WHERE tm.club_id=${club}.id AND tm.user_id=${user} AND tm.status='active')
        OR EXISTS (SELECT 1 FROM club_coordinators cc WHERE cc.club_id=${club}.id AND cc.linked_user_id=${user})
        OR EXISTS (SELECT 1 FROM workspace_members wm JOIN team_workspaces tw ON tw.id=wm.workspace_id
            WHERE tw.club_id=${club}.id AND tw.workspace_status='active' AND wm.user_id=${user}
            AND wm.membership_status='active' AND NOT wm.is_suspended))`;
}
export function adminSql(club = 'c', user = '$1') {
    return `(${club}.auth_user_id=${user}
        OR EXISTS (SELECT 1 FROM club_memberships am WHERE am.club_id=${club}.id AND am.user_id=${user} AND am.status='active' AND am.access_role IN ('owner','admin'))
        OR EXISTS (SELECT 1 FROM workspace_members aw JOIN team_workspaces atw ON atw.id=aw.workspace_id JOIN workspace_roles ar ON ar.id=aw.role_id
            WHERE atw.club_id=${club}.id AND atw.workspace_status='active' AND aw.user_id=${user}
            AND aw.membership_status='active' AND NOT aw.is_suspended AND ar.slug IN ('owner','admin')))`;
}
export function visibilitySql() {
    return `((${membershipSql()} AND (a.status='published' OR a.author_id=$1 OR ${adminSql()}))
        OR (a.status='published' AND c.visibility='public' AND c.publication_status='published' AND c.profile_visibility='public' AND c.college_id IS NOT NULL AND EXISTS
            (SELECT 1 FROM verified_clubs vc WHERE vc.college_id=c.college_id AND vc.is_active AND ${membershipSql('vc')})))`;
}
