import type { RequestHandler } from 'express';
import { query } from '../database/client.js';
import { getBlockState } from '../services/relationship/blockService.js';
import { isDemoProfileHandle } from '../validators/usernamePolicy.js';

/** Check visibility before legacy analytics handlers can read shared Redis caches. */
export const publicAnalyticsPrivacy: RequestHandler = async (req, res, next) => {
    try {
        const username = String(req.query.username || req.body?.username || req.user?.username || '').trim();
        if (!username) { res.status(400).json({ success: false, message: 'Username required.' }); return; }
        if (isDemoProfileHandle(username)) return next();
        const result = await query('SELECT id, username, is_public FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [username]);
        const user = result.rows[0];
        if (!user) { res.status(404).json({ success: false, message: 'Profile unavailable.' }); return; }
        if (req.user?.id === user.id) return next();
        if (user.is_public !== true || (req.user?.id && (await getBlockState(req.user.id, user.id)).isBlocked)) {
            res.status(404).json({ success: false, message: 'Profile unavailable.' }); return;
        }
        // Legacy aggregates combine all linked platforms in one cached object. Never expose a
        // mixed public/private aggregate; public profile cards still show public platforms.
        const hidden = await query(`SELECT 1 FROM user_links WHERE
            (user_id = $1 OR LOWER(username) = LOWER($2) OR LOWER(username) = (SELECT LOWER(email) FROM users WHERE id = $1))
            AND is_public IS NOT TRUE LIMIT 1`, [user.id, user.username]);
        if (hidden.rows.length) {
            res.status(403).json({ success: false, message: 'These analytics are private.' }); return;
        }
        next();
    } catch (error) { next(error); }
};
