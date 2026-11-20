/// <reference path="../../types/express.d.ts" />
import express, { type ErrorRequestHandler } from 'express';
import crypto from 'node:crypto';
import { MEDIA_RULES, type MediaKind } from '../../../../shared/announcements.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { pool } from '../../database/client.js';
import { AnnouncementError, pageLimit, parseCursor, requireId, validatePublication } from '../../services/announcements/announcementPolicy.js';
import * as repository from '../../services/announcements/announcementRepository.js';
import * as media from '../../services/announcements/announcementMediaService.js';

const router = express.Router();
// Club members use their existing personal sessions; owners use their existing club sessions.
router.use(authenticate);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
async function hydrate(rows: Array<Record<string, unknown>>) {
    const assets = await repository.assetsFor(rows.map(row => String(row.id)));
    return rows.map(({ cursorTime: _cursorTime, ...row }) => ({ ...row,
        attachments: assets.filter(asset => asset.announcement_id === row.id).map(media.serializeAsset),
    }));
}
router.get('/context', async (req, res) => {
    const clubs = await repository.getClubs(req.user!.id);
    res.json({ success: true, data: { clubs, mediaLimits: Object.fromEntries(Object.keys(MEDIA_RULES).map(key => [key, media.configuredMediaLimit(key as MediaKind)])) } });
});
router.get('/', async (req, res) => {
    const club = await repository.requireClub(req.user!.id, requireId(req.query.clubId));
    const scope = req.query.scope ?? 'mine';
    if (scope !== 'mine' && scope !== 'campus') throw new AnnouncementError(400, 'Invalid feed scope.');
    const page = await repository.fetchPage(req.user!.id, club, scope, pageLimit(req.query.limit), parseCursor(req.query.cursor));
    res.json({ success: true, data: { announcements: await hydrate(page.rows), pagination: page.pagination } });
});
router.post('/uploads/signature', async (req, res) => {
    const clubId = requireId(req.body?.clubId);
    await repository.requireClub(req.user!.id, clubId);
    await repository.rateLimit(req.user!.id, 'upload', 60, 3600);
    res.json({ success: true, data: await media.createUpload(req.user!.id, clubId, req.body) });
});
router.post('/uploads/:id/complete', async (req, res) => {
    const id = requireId(req.params.id);
    const asset = (await pool.query('SELECT club_id FROM club_announcement_assets WHERE id=$1 AND uploader_id=$2', [id, req.user!.id])).rows[0];
    if (!asset) throw new AnnouncementError(404, 'Upload not found.');
    await repository.requireClub(req.user!.id, asset.club_id);
    await repository.rateLimit(req.user!.id, 'verify-upload', 90, 3600);
    res.json({ success: true, data: await media.completeUpload(req.user!.id, id) });
});
router.delete('/uploads/:id', async (req, res) => {
    await repository.rateLimit(req.user!.id, 'discard-upload', 120, 3600);
    await media.discardUpload(req.user!.id, requireId(req.params.id));
    res.json({ success: true });
});
router.post('/', async (req, res) => {
    const clubId = requireId(req.body?.clubId);
    const requestId = requireId(req.body?.clientRequestId);
    const input = validatePublication(req.body);
    await repository.requireClub(req.user!.id, clubId);
    await repository.rateLimit(req.user!.id, 'publish', 30, 3600);
    const id = await repository.writeAnnouncement(req.user!.id, clubId, requestId, input);
    res.status(201).json({ success: true, data: (await hydrate([await repository.fetchOne(req.user!.id, id)]))[0] });
});
router.get('/:id', async (req, res) => {
    const row = await repository.fetchOne(req.user!.id, requireId(req.params.id));
    res.json({ success: true, data: (await hydrate([row]))[0] });
});
router.patch('/:id', async (req, res) => {
    const id = requireId(req.params.id);
    const input = validatePublication(req.body);
    const current = await repository.requireAnnouncement(req.user!.id, id);
    await repository.requireClub(req.user!.id, current.club_id);
    await repository.rateLimit(req.user!.id, 'edit', 60, 3600);
    await repository.writeAnnouncement(req.user!.id, current.club_id, crypto.randomUUID(), input, id);
    res.json({ success: true, data: (await hydrate([await repository.fetchOne(req.user!.id, id)]))[0] });
});
router.delete('/:id', async (req, res) => {
    await repository.rateLimit(req.user!.id, 'delete', 60, 3600);
    await repository.removeAnnouncement(req.user!.id, requireId(req.params.id));
    res.json({ success: true });
});
for (const method of ['put', 'delete'] as const) router[method]('/:id/like', async (req, res) => {
    await repository.rateLimit(req.user!.id, 'like', 120);
    res.json({ success: true, data: await repository.setLike(req.user!.id, requireId(req.params.id), method === 'put') });
});
const handleError: ErrorRequestHandler = (error, req, res, _next) => {
    const status = error instanceof AnnouncementError ? error.status : 500;
    if (status >= 500) {
        console.error('[Announcements] Internal Error:', error?.message || error);
    }
    console.warn('[Announcements]', { method: req.method, status, actorId: req.user?.id });
    if (status === 429) res.set('Retry-After', String(error.retryAfter || 60));
    res.status(status).json({ success: false, message: error instanceof AnnouncementError ? error.message : 'Announcements are temporarily unavailable. Please try again.' });
};
router.use(handleError);
export default router;
