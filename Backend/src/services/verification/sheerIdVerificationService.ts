import { randomUUID, createHash } from 'node:crypto';
import { pool, query } from '../../database/client.js';
import { deleteUserDetailsCache } from '../../redis/cache/cache-auth.js';
import { invalidateAllUserCaches } from '../../redis/cache/cache-profile.js';
import { resolveSheerIdResult, type SheerIdDetails } from './sheerIdPolicy.js';

export function verificationError(message: string, statusCode = 400) {
    return Object.assign(new Error(message), { statusCode });
}
const configured = () => Boolean(process.env.SHEERID_API_TOKEN && process.env.SHEERID_PROGRAM_ID && process.env.SHEERID_WEBHOOK_SECRET);
async function providerRequest(path: string, method = 'GET', body?: object) {
    if (!configured()) throw verificationError('Enrollment verification is being set up. Please try again later.', 503);
    let response: globalThis.Response;
    try {
        response = await fetch(`https://services.sheerid.com/rest/v2/${path}`, {
            method, headers: { Authorization: `Bearer ${process.env.SHEERID_API_TOKEN}`, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(6000), redirect: 'error',
        });
    } catch { throw verificationError('The verification provider is temporarily unavailable. Your progress is saved.', 503); }
    if (!response.ok) throw verificationError('The verification provider is temporarily unavailable. Please try again later.', 503);
    return response.json();
}
function hostedUrl(row: any) {
    return row.provider_verification_id && row.provider_program_id && row.status === 'PENDING' && row.provider_step !== 'smsLoop'
        ? `https://services.sheerid.com/verify/${encodeURIComponent(row.provider_program_id)}/?verificationId=${encodeURIComponent(row.provider_verification_id)}` : null;
}
async function invalidate(userId: string) {
    await deleteUserDetailsCache(userId);
    const user = await query('SELECT username FROM users WHERE id = $1', [userId]);
    if (user.rows[0]?.username) await invalidateAllUserCaches({ id: userId, username: user.rows[0].username });
}

export class SheerIdVerificationService {
    static async status(userId: string) {
        const expired = await query(`UPDATE college_verifications SET status = 'INVALIDATED',
            rejection_reason = 'Your verification has expired. Please verify current enrollment again.', updated_at = now()
            WHERE user_id = $1 AND ((status = 'APPROVED' AND expires_at <= now()) OR
                (status IN ('PENDING','PROCESSING') AND created_at < now() - interval '7 days')) RETURNING id`, [userId]);
        if (expired.rowCount) {
            await query(`UPDATE users u SET is_college_verified = false, college_verified_at = NULL WHERE id = $1
                AND NOT EXISTS (SELECT 1 FROM college_verifications cv WHERE cv.user_id = u.id AND cv.college_id = u.college_id
                    AND cv.status = 'APPROVED' AND cv.expires_at > now())`, [userId]);
            await invalidate(userId);
        }
        const user = (await query(`SELECT u.college_id, i.official_name, i.city, i.state, i.sheerid_organization_id
            FROM users u LEFT JOIN institutions i ON u.college_id = i.id WHERE u.id = $1`, [userId])).rows[0];
        if (!user) throw verificationError('Account not found.', 404);
        const rows = (await query(`SELECT id, college_id, status, student_name, provider, provider_verification_id,
            provider_program_id, provider_step, rejection_reason, verified_at, expires_at, created_at, updated_at
            FROM college_verifications WHERE user_id = $1 AND college_id = $2 ORDER BY created_at DESC LIMIT 10`, [userId, user.college_id])).rows;
        const active = rows.find(r => r.status === 'APPROVED' || r.status === 'PENDING' || r.status === 'PROCESSING');
        const latest = active || rows[0];
        return {
            success: true, status: latest?.status || 'NOT_VERIFIED', isCollegeVerified: active?.status === 'APPROVED',
            currentCollege: user.college_id ? { id: user.college_id, officialName: user.official_name, city: user.city, state: user.state } : null,
            activeApplication: active || null, latestApplication: latest || null, history: rows,
            provider: { available: configured() && Boolean(user.sheerid_organization_id), resumeUrl: latest ? hostedUrl(latest) : null },
        };
    }

    static async start(userId: string, input: { collegeId?: string; studentName?: string; consent?: boolean }) {
        if (!configured()) throw verificationError('Enrollment verification is being set up. Please try again later.', 503);
        if (input.consent !== true || typeof input.studentName !== 'string' || input.studentName.trim().length < 2 || input.studentName.length > 255) {
            throw verificationError('Confirm your full name and consent to enrollment verification.');
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const user = (await client.query(`SELECT u.college_id, u.email, u.is_email_verified, i.sheerid_organization_id
                FROM users u LEFT JOIN institutions i ON i.id = u.college_id WHERE u.id = $1 FOR UPDATE OF u`, [userId])).rows[0];
            if (!user || user.college_id !== input.collegeId) throw verificationError('Save your selected college in your profile before verifying.');
            if (!user.is_email_verified) throw verificationError('Verify your account email in Settings first. Gmail is supported; no phone is needed.', 403);
            if (!user.sheerid_organization_id) throw verificationError('Verification is not available for this college yet. Contact support to request coverage.', 409);
            await client.query(`UPDATE college_verifications SET status = 'INVALIDATED', updated_at = now()
                WHERE user_id = $1 AND ((status = 'APPROVED' AND expires_at <= now()) OR
                (status IN ('PENDING','PROCESSING') AND (provider IS NULL OR created_at < now() - interval '7 days')))`, [userId]);
            const existing = (await client.query(`SELECT * FROM college_verifications WHERE user_id = $1
                AND status IN ('APPROVED', 'PENDING', 'PROCESSING') ORDER BY created_at DESC LIMIT 1`, [userId])).rows[0];
            if (existing) {
                if (existing.college_id !== user.college_id) throw verificationError('Finish or cancel your previous verification first.', 409);
                await client.query('COMMIT');
                return { success: true, resumeUrl: hostedUrl(existing), alreadyVerified: existing.status === 'APPROVED' };
            }
            const attempts = (await client.query(`SELECT count(*)::int AS count FROM college_verifications WHERE user_id = $1 AND created_at > now() - interval '1 day'`, [userId])).rows[0].count;
            if (attempts >= 3) throw verificationError('You have reached today’s verification limit. Please try again tomorrow or contact support.', 429);
            // Reserve the attempt before calling the provider. The user row lock serializes starts across replicas.
            const id = randomUUID();
            await client.query(`INSERT INTO college_verifications
                (id,user_id,college_id,status,document_type,provider,provider_program_id,provider_institution_id,student_name,institution_email,consented_at)
                VALUES ($1,$2,$3,'PENDING','provider_hosted','sheerid',$4,$5,$6,$7,now())`,
                [id,userId,user.college_id,process.env.SHEERID_PROGRAM_ID,user.sheerid_organization_id,input.studentName.trim(),user.email]);
            let result: any;
            try { result = await providerRequest('verification', 'POST', { programId: process.env.SHEERID_PROGRAM_ID }); }
            catch (error) {
                await client.query(`UPDATE college_verifications SET status = 'INVALIDATED', updated_at = now() WHERE id = $1`, [id]);
                await client.query('COMMIT');
                throw error;
            }
            if (!/^[a-zA-Z0-9-]{12,128}$/.test(result.verificationId || '')) throw verificationError('Invalid provider session response.', 502);
            const row = (await client.query(`UPDATE college_verifications SET provider_verification_id = $2,
                provider_step = $3, updated_at = now() WHERE id = $1 RETURNING *`, [id,result.verificationId,result.currentStep])).rows[0];
            await client.query(`INSERT INTO college_verification_events (verification_id,event_key,status) VALUES ($1,$2,'PENDING')`, [id,`start:${id}`]);
            await client.query('COMMIT');
            return { success: true, resumeUrl: hostedUrl(row), alreadyVerified: false };
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
    }

    static async reconcile(sessionId: string, eventKey?: string, userId?: string) {
        await this.reconcileLocked(sessionId, eventKey, userId);
        const owner = (await query('SELECT user_id FROM college_verifications WHERE provider_verification_id = $1', [sessionId])).rows[0]?.user_id;
        if (owner) await invalidate(owner);
    }

    private static async reconcileLocked(sessionId: string, eventKey?: string, userId?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const owner = (await client.query(`SELECT user_id FROM college_verifications WHERE provider_verification_id = $1 ${userId ? 'AND user_id = $2' : ''}`,
                userId ? [sessionId,userId] : [sessionId])).rows[0];
            if (!owner) { await client.query('COMMIT'); return; }
            await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [owner.user_id]);
            // Match ownership before any provider call; serialize fetches so older results cannot overwrite newer ones.
            const row = (await client.query(`SELECT cv.* FROM college_verifications cv
                WHERE provider_verification_id = $1 AND provider = 'sheerid' ${userId ? 'AND user_id = $2' : ''} FOR UPDATE`,
                userId ? [sessionId,userId] : [sessionId])).rows[0];
            if (!row) { await client.query('COMMIT'); return; }
            // Invalidated sessions (college changed/expired) must never be revived by late notifications.
            if (row.status === 'INVALIDATED' || row.status === 'REJECTED' || (userId && row.provider_checked_at && Date.now() - new Date(row.provider_checked_at).getTime() < 15000)) {
                await client.query('COMMIT'); return;
            }
            const details: SheerIdDetails = await providerRequest(`verification/${encodeURIComponent(sessionId)}/details`);
            const result = resolveSheerIdResult(details, { sessionId, programId: row.provider_program_id,
                institutionId: row.provider_institution_id, email: row.institution_email, name: row.student_name });
            // Approval is terminal for ordinary callbacks; renewal creates a new session.
            if (row.status === 'APPROVED') { await client.query('COMMIT'); return; }
            const changed = result.status !== row.status || result.step !== row.provider_step || result.reason !== row.rejection_reason;
            await client.query(`UPDATE college_verifications SET status = $2, provider_step = $3, rejection_reason = $4,
                verified_at = CASE WHEN $2 = 'APPROVED' THEN now() ELSE NULL END, expires_at = $5,
                provider_checked_at = now(), updated_at = CASE WHEN $6 THEN now() ELSE updated_at END WHERE id = $1`, [row.id,result.status,result.step,result.reason,result.expiresAt,changed]);
            // Even an identical older webhook body may signal a newer provider state. Always fetch first.
            const snapshot = createHash('sha256').update(JSON.stringify([details.updated,result])).digest('hex');
            const key = `${eventKey || `fetch:${row.id}`}:${snapshot}`;
            await client.query(`INSERT INTO college_verification_events (verification_id,event_key,status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [row.id,key,result.status]);
            if (result.status !== row.status) {
                await client.query(`UPDATE users SET is_college_verified = $2, college_verified_at = CASE WHEN $2 THEN now() ELSE NULL END
                    WHERE id = $1 AND college_id = $3`, [row.user_id,result.status === 'APPROVED',row.college_id]);
            }
            await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
    }
    static async refresh(userId: string) {
        const row = (await query(`SELECT provider_verification_id FROM college_verifications WHERE user_id = $1
            AND provider = 'sheerid' AND status IN ('PENDING','PROCESSING') ORDER BY created_at DESC LIMIT 1`, [userId])).rows[0];
        if (row?.provider_verification_id) await this.reconcile(row.provider_verification_id, undefined, userId);
        return this.status(userId);
    }
}
