import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { validSheerIdSignature } from '../../services/verification/sheerIdPolicy.js';
import { SheerIdVerificationService } from '../../services/verification/sheerIdVerificationService.js';

export async function sheerIdWebhook(req: Request, res: Response) {
    if (!process.env.SHEERID_WEBHOOK_SECRET) return res.sendStatus(503);
    if (!Buffer.isBuffer(req.body) || !validSheerIdSignature(req.body, req.get('X-SheerID-Signature') || '', process.env.SHEERID_WEBHOOK_SECRET)) {
        return res.sendStatus(401);
    }
    let event: any;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.sendStatus(400); }
    if (typeof event.verificationId !== 'string' || !/^[a-zA-Z0-9-]{12,128}$/.test(event.verificationId)) return res.sendStatus(400);
    // Optional enhanced signing fields must be supplied together. Older legitimate retries have no timestamp.
    if ((event.timestamp !== undefined || event.nonce !== undefined) &&
        (!Number.isFinite(event.timestamp) || typeof event.nonce !== 'string' || event.nonce.length < 8 || event.timestamp > Date.now() + 300000)) return res.sendStatus(400);
    try {
        await SheerIdVerificationService.reconcile(event.verificationId, `webhook:${createHash('sha256').update(req.body).digest('hex')}`);
        return res.sendStatus(204);
    } catch {
        console.error('[CollegeVerification] Webhook reconciliation failed; delivery should retry');
        return res.sendStatus(503);
    }
}
