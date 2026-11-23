import { plainText, safeImage } from '../../../shared/seo/site.js';
import { SITEMAP_PAGE_SIZE, type SitemapItem } from '../../../shared/seo/crawling.js';
import type { PageData, PublicEntity } from '../../../shared/seo/metadata.js';
export const PUBLIC_CLUB_SQL = "vc.is_active IS TRUE AND vc.visibility = 'public' AND vc.publication_status = 'published' AND vc.profile_visibility = 'public'";
export const PUBLIC_EVENT_SQL = `${PUBLIC_CLUB_SQL} AND e.status = 'published' AND e.scope = 'PAN_INDIA' AND e.eligibility = 'open_to_all'`;
export type Query = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
const liveQuery: Query = async (sql, values) => (await import('../database/client.js')).query(sql, values);
const validDate = (value: unknown): string | undefined => { const date = new Date(String(value || '')); return Number.isFinite(date.getTime()) ? date.toISOString() : undefined; };
export function createPublicRepository(query: Query = liveQuery, origin: string | null = null) {
    const eventEntity = (row: Record<string, unknown>): PublicEntity => ({ kind: 'event', path: `/events/${row.id}`, title: String(row.title), description: plainText(row.description || row.summary || `${row.title} is a public event organized by ${row.club_name}. View the schedule and registration requirements.`, 12000), image: safeImage(row.cover_image_url, origin), startsAt: validDate(row.starts_at instanceof Date ? row.starts_at.toISOString() : row.starts_at), endsAt: validDate(row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at), updatedAt: validDate(row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at), locationType: String(row.location_type), venue: plainText(row.venue_or_location, 200), clubName: String(row.club_name), clubPath: `/clubs/${encodeURIComponent(String(row.club_slug))}` });
    return {
        async page(path: string, page = 1): Promise<PageData | null> {
            if (path === '/clubs') {
                const result = await query(`SELECT vc.name, vc.short_description, vc.about, vc.cover_image_url, COALESCE(u.username,vc.slug) AS slug FROM verified_clubs vc LEFT JOIN users u ON u.id = vc.auth_user_id WHERE ${PUBLIC_CLUB_SQL} ORDER BY vc.name,vc.id LIMIT 25 OFFSET $1`, [(page-1)*24]);
                if (page > 1 && !result.rows.length) return null;
                return { clubs: result.rows.slice(0,24).map(row => ({ kind: 'club', path: `/clubs/${encodeURIComponent(String(row.slug))}`, title: String(row.name), description: plainText(row.short_description || row.about, 500), image: safeImage(row.cover_image_url,origin) })), page, hasNext: result.rows.length > 24 };
            }
            if (path.startsWith('/clubs/')) {
                const result = await query(`SELECT vc.name, vc.category, vc.about, vc.short_description, vc.logo_url, vc.cover_image_url,
                    vc.college_name, vc.college_city, vc.college_state, vc.college_country, vc.founded_year,
                    vc.updated_at, COALESCE(u.username, vc.slug) AS slug
                    FROM verified_clubs vc LEFT JOIN users u ON u.id = vc.auth_user_id
                    WHERE ${PUBLIC_CLUB_SQL} AND (LOWER(vc.slug) = LOWER($1) OR LOWER(u.username) = LOWER($1)) LIMIT 1`, [path.slice(7)]);
                const row = result.rows[0]; if (!row) return null;
                const club = { name: row.name, slug: row.slug, category: row.category, about: plainText(row.about, 12000), shortDescription: plainText(row.short_description, 500), collegeName: row.college_name, collegeCity: row.college_city, collegeState: row.college_state, collegeCountry: row.college_country, logoUrl: safeImage(row.logo_url, origin), coverImageUrl: safeImage(row.cover_image_url, origin), foundedYear: row.founded_year, focusAreas: [], operatingStatus: 'active' };
                return { entity: { kind: 'club', path: `/clubs/${encodeURIComponent(String(row.slug))}`, title: String(row.name), description: plainText(row.short_description || row.about || `${row.name} at ${row.college_name}`, 12000), image: safeImage(row.cover_image_url || row.logo_url, origin), updatedAt: validDate(row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at), club } };
            }
            const select = `SELECT e.id, e.title, e.description, e.summary, e.starts_at, e.ends_at, e.updated_at, e.location_type, e.venue_or_location,
                e.cover_image_url, vc.name AS club_name, COALESCE(u.username, vc.slug) AS club_slug
                FROM club_events e JOIN verified_clubs vc ON vc.id = e.club_id LEFT JOIN users u ON u.id = vc.auth_user_id`;
            if (path === '/events') {
                const offset = (Math.max(1, Math.min(10000, page)) - 1) * 24;
                const result = await query(`${select} WHERE ${PUBLIC_EVENT_SQL} ORDER BY e.starts_at DESC, e.id LIMIT 25 OFFSET $1`, [offset]);
                if (page > 1 && !result.rows.length) return null;
                return { events: result.rows.slice(0,24).map(eventEntity), page, hasNext: result.rows.length > 24 };
            }
            if (/^\/events\/[0-9a-f-]{36}$/i.test(path)) {
                const result = await query(`${select} WHERE ${PUBLIC_EVENT_SQL} AND e.id = $1::uuid LIMIT 1`, [path.slice(8)]);
                return result.rows[0] ? { entity: eventEntity(result.rows[0]) } : null;
            }
            return null;
        },
        async isUnlistedClub(path: string): Promise<boolean> {
            const result = await query(`SELECT 1 FROM verified_clubs vc LEFT JOIN users u ON u.id = vc.auth_user_id
                WHERE vc.is_active IS TRUE AND vc.visibility = 'unlisted'
                  AND vc.publication_status = 'published' AND vc.profile_visibility = 'unlisted'
                  AND (LOWER(vc.slug) = LOWER($1) OR LOWER(u.username) = LOWER($1)) LIMIT 1`, [path.slice(7)]);
            return result.rows.length > 0;
        },
        async counts(): Promise<{ clubs: number; events: number }> {
            const result = await query(`SELECT (SELECT COUNT(*) FROM verified_clubs vc WHERE ${PUBLIC_CLUB_SQL}) AS clubs,
                (SELECT COUNT(*) FROM club_events e JOIN verified_clubs vc ON vc.id = e.club_id WHERE ${PUBLIC_EVENT_SQL}) AS events`);
            return { clubs: Number(result.rows[0]?.clubs || 0), events: Number(result.rows[0]?.events || 0) };
        },
        async sitemap(kind: 'clubs' | 'events', page: number): Promise<SitemapItem[]> {
            const result = kind === 'clubs' ? await query(`SELECT COALESCE(u.username, vc.slug) AS slug, vc.updated_at FROM verified_clubs vc LEFT JOIN users u ON u.id = vc.auth_user_id WHERE ${PUBLIC_CLUB_SQL} ORDER BY vc.id LIMIT $1 OFFSET $2`, [SITEMAP_PAGE_SIZE, (page - 1) * SITEMAP_PAGE_SIZE]) : await query(`SELECT e.id, e.updated_at FROM club_events e JOIN verified_clubs vc ON vc.id = e.club_id WHERE ${PUBLIC_EVENT_SQL} ORDER BY e.id LIMIT $1 OFFSET $2`, [SITEMAP_PAGE_SIZE, (page - 1) * SITEMAP_PAGE_SIZE]);
            return result.rows.map(row => ({ path: kind === 'clubs' ? `/clubs/${encodeURIComponent(String(row.slug))}` : `/events/${row.id}`, updatedAt: validDate(row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) }));
        },
    };
}
export type PublicRepository = ReturnType<typeof createPublicRepository>;
