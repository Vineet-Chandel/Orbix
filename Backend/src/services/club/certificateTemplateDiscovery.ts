import { query } from "../../database/client.js";

export async function recordOfficialTemplateView(clubId: string, userId: string, templateId: string) {
    const result = await query(
        `INSERT INTO certificate_template_view_history AS history (club_id, user_id, template_ids)
         SELECT $1, $2, ARRAY[t.id]
         FROM certificate_templates t
         WHERE t.id = $3 AND t.is_system AND t.status = 'published'
         ON CONFLICT (club_id, user_id) DO UPDATE SET template_ids =
           (EXCLUDED.template_ids || array_remove(history.template_ids, $3::uuid))[1:10]
         RETURNING template_ids;`,
        [clubId, userId, templateId],
    );
    return result.rows[0]?.template_ids as string[] | undefined;
}

export async function getCertificateTemplateDiscovery(clubId: string, userId: string) {
    const [history, personal, rankings] = await Promise.all([
        query(
            `SELECT history.template_ids FROM certificate_template_view_history history
             WHERE history.club_id = $1 AND history.user_id = $2;`,
            [clubId, userId],
        ),
        query(
            `WITH usage AS (
                SELECT issued.template_id, MAX(issued.created_at) AS used_at
                FROM club_certificates issued
                WHERE issued.club_id = $1 AND issued.is_revoked = false AND issued.template_id IS NOT NULL
                GROUP BY issued.template_id
                UNION ALL
                SELECT id, last_used_at FROM certificate_templates WHERE club_id = $1 AND last_used_at IS NOT NULL
             )
             SELECT t.id AS template_id, COALESCE(t.official_template_id, CASE WHEN t.is_system THEN t.id END) AS official_id
             FROM usage
             JOIN certificate_templates t ON t.id = usage.template_id
             WHERE t.status <> 'archived' AND (t.is_system OR t.club_id = $1)
             GROUP BY t.id
             ORDER BY MAX(usage.used_at) DESC, t.id
             LIMIT 20;`,
            [clubId],
        ),
        query(
            `SELECT official.id,
                    COUNT(DISTINCT issued.club_id) AS global_clubs,
                    COUNT(DISTINCT COALESCE(issued.batch_id, issued.id)) AS global_uses,
                    COUNT(DISTINCT issued.club_id) FILTER (WHERE
                        peer.college_id = viewer.college_id AND peer.id <> viewer.id AND
                        issued.created_at >= NOW() - INTERVAL '30 days') AS campus_clubs,
                    COUNT(DISTINCT COALESCE(issued.batch_id, issued.id)) FILTER (WHERE
                        peer.college_id = viewer.college_id AND peer.id <> viewer.id AND
                        issued.created_at >= NOW() - INTERVAL '30 days') AS campus_uses
             FROM club_certificates issued
             JOIN certificate_templates source ON source.id = issued.template_id
             JOIN certificate_templates official ON official.id = COALESCE(source.official_template_id, source.id)
               AND official.is_system AND official.status = 'published'
             JOIN verified_clubs peer ON peer.id = issued.club_id
             JOIN verified_clubs viewer ON viewer.id = $1
             WHERE issued.is_revoked = false AND issued.created_at >= NOW() - INTERVAL '90 days'
               AND (source.is_system OR source.club_id = issued.club_id)
             GROUP BY official.id;`,
            [clubId],
        ),
    ]);
    const rank = (scope: "global" | "campus") => rankings.rows
        .filter((row) => Number(row[`${scope}_clubs`]) > 0)
        .sort((a, b) => Number(b[`${scope}_clubs`]) - Number(a[`${scope}_clubs`]) ||
            Number(b[`${scope}_uses`]) - Number(a[`${scope}_uses`]) || a.id.localeCompare(b.id))
        .slice(0, 20)
        .map((row) => row.id as string);

    return {
        recentlyViewedIds: (history.rows[0]?.template_ids || []) as string[],
        recentlyUsedIds: personal.rows.map((row) => row.template_id as string),
        usedOfficialIds: [...new Set(personal.rows.flatMap((row) => row.official_id ? [row.official_id as string] : []))],
        trendingIds: rank("campus"),
        popularIds: rank("global"),
    };
}
