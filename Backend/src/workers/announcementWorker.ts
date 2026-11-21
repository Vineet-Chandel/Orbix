import { pool } from '../database/client.js';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { transaction } from '../services/announcements/announcementRepository.js';
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
export async function runAnnouncementMaintenance() {
    if (running) return;
    running = true;
    try {
        if (!(await pool.query("SELECT to_regclass('public.club_announcement_jobs') AS table_name")).rows[0]?.table_name) return;
        await transaction(async client => {
            const jobs = await client.query(`SELECT j.announcement_id FROM club_announcement_jobs j WHERE j.processed_at IS NULL
                ORDER BY j.created_at LIMIT 10 FOR UPDATE SKIP LOCKED`);
            for (const job of jobs.rows) {
                // Reuse durable platform notifications and the workspace's existing mute preferences.
                await client.query(`INSERT INTO user_notifications(user_id,recipient_id,username,title,body,type,notification_type,metadata,idempotency_key,actor_id)
                    SELECT u.id,u.id,u.username,LEFT(c.name || ' shared an announcement',200),LEFT(COALESCE(NULLIF(a.plain_text,''),'New media announcement'),300),
                        'club_announcement','club_announcement_published',jsonb_build_object('announcementId',a.id,'clubId',c.id,'destinationUrl','/announcements/' || a.id::text),
                        'club-announcement-' || a.id::text || '-' || u.id::text,a.author_id
                    FROM club_announcements a JOIN verified_clubs c ON c.id=a.club_id JOIN users u ON u.id IN (
                        SELECT c.auth_user_id UNION SELECT cm.user_id FROM club_memberships cm WHERE cm.club_id=c.id AND cm.status='active'
                        UNION SELECT tm.user_id FROM club_team_members tm WHERE tm.club_id=c.id AND tm.status='active'
                        UNION SELECT cc.linked_user_id FROM club_coordinators cc WHERE cc.club_id=c.id
                        UNION SELECT wm.user_id FROM workspace_members wm JOIN team_workspaces tw ON tw.id=wm.workspace_id
                          WHERE tw.club_id=c.id AND tw.workspace_status='active' AND wm.membership_status='active' AND NOT wm.is_suspended)
                    WHERE a.id=$1 AND a.status='published' AND a.deleted_at IS NULL AND c.is_active AND u.id<>a.author_id
                    AND NOT EXISTS (SELECT 1 FROM workspace_notification_preferences np JOIN team_workspaces tw ON tw.id=np.workspace_id
                        WHERE tw.club_id=c.id AND np.user_id=u.id AND np.muted_until>NOW())
                    ON CONFLICT(idempotency_key) DO NOTHING`, [job.announcement_id]);
                await client.query('UPDATE club_announcement_jobs SET processed_at=NOW() WHERE announcement_id=$1', [job.announcement_id]);
            }
        });
        if (isCloudinaryConfigured()) {
            const assets = await transaction(async client => {
                const selected = await client.query(`SELECT id,public_id,resource_type FROM club_announcement_assets
                    WHERE announcement_id IS NULL AND state<>'deleted' AND expires_at<NOW() ORDER BY expires_at LIMIT 10 FOR UPDATE SKIP LOCKED`);
                if (selected.rows.length) await client.query(`UPDATE club_announcement_assets SET state='cleanup',expires_at=NOW()+INTERVAL '10 minutes' WHERE id=ANY($1::uuid[])`, [selected.rows.map(row => row.id)]);
                return selected.rows;
            });
            for (const asset of assets) {
                try {
                    // resource_type is excluded from Cloudinary signatures; also clear unexpected resource types.
                    const results = await Promise.all((['image', 'video', 'raw'] as const).map(resourceType => cloudinary.uploader.destroy(asset.public_id, { resource_type: resourceType, type: 'authenticated', invalidate: true })));
                    if (results.every(result => result.result === 'ok' || result.result === 'not found')) await pool.query("UPDATE club_announcement_assets SET state='deleted' WHERE id=$1 AND state='cleanup' AND announcement_id IS NULL", [asset.id]);
                } catch { console.warn('[Announcements] Orphan cleanup will retry', { assetId: asset.id }); }
            }
        }
        await pool.query('DELETE FROM club_announcement_limits WHERE expires_at<NOW()');
    } catch { console.warn('[Announcements] Background maintenance will retry.'); }
    finally { running = false; }
}
export function startAnnouncementWorker() {
    if (timer) return;
    timer = setInterval(() => { void runAnnouncementMaintenance(); }, 30000);
    timer.unref();
    void runAnnouncementMaintenance();
}
export function stopAnnouncementWorker() { if (timer) clearInterval(timer); timer = undefined; }
