import crypto from 'node:crypto';
import { pool } from '../../database/client.js';
import { assertCloudinaryConfigured, cloudinary } from '../../config/cloudinary.js';
import { MEDIA_RULES, validateSelectedFile, type MediaKind, type AnnouncementAttachment } from '../../../../shared/announcements.js';
import { AnnouncementError } from './announcementPolicy.js';
import { transaction } from './announcementRepository.js';

type AssetRow = Record<string, unknown> & { id: string; public_id: string; resource_type: 'image' | 'video' | 'raw'; media_type: MediaKind; filename: string; mime_type: string; bytes: number; format: string; announcement_id: string | null };
export function configuredMediaLimit(kind: MediaKind) {
    const configured = Number(process.env[`ANNOUNCEMENT_${kind.toUpperCase()}_MAX_BYTES`]);
    return Number.isSafeInteger(configured) && configured > 0 ? Math.min(configured, MEDIA_RULES[kind].maxBytes) : MEDIA_RULES[kind].maxBytes;
}
export function serializeAsset(row: AssetRow): AnnouncementAttachment {
    assertCloudinaryConfigured();
    const downloadUrl = cloudinary.utils.private_download_url(row.public_id, row.resource_type === 'raw' ? '' : row.format, {
        resource_type: row.resource_type, type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 900, attachment: false,
    });
    const imageUrl = (width: number) => cloudinary.url(row.public_id, {
        resource_type: 'image', type: 'authenticated', secure: true, sign_url: true,
        version: String(row.version || ''), width, crop: 'limit', quality: 'auto', fetch_format: 'auto',
    });
    const url = row.media_type === 'image' ? imageUrl(960) : row.media_type === 'video' ? cloudinary.url(row.public_id, {
        resource_type: 'video', type: 'authenticated', secure: true, sign_url: true, format: 'mp4',
        version: String(row.version || ''), transformation: [{ quality: 'auto', video_codec: 'auto' }],
    }) : downloadUrl;
    return {
        ...(row.media_type === 'image' ? { srcSet: [480,960,1600].map(width => `${imageUrl(width)} ${width}w`).join(', ') } : {}),
        downloadUrl,
        id: row.id, publicId: row.public_id, resourceType: row.resource_type, mediaType: row.media_type,
        filename: row.filename, mimeType: row.mime_type, bytes: Number(row.bytes), format: row.format,
        width: row.width == null ? null : Number(row.width), height: row.height == null ? null : Number(row.height),
        duration: row.duration == null ? null : Number(row.duration), url,
        thumbnailUrl: row.media_type === 'video' ? cloudinary.url(row.public_id, { resource_type: 'video', type: 'authenticated', secure: true, sign_url: true, format: 'jpg', transformation: [{ width: 800, crop: 'limit', quality: 'auto' }] }) : null,
        displayOrder: Number(row.display_order || 0),
    };
}
export async function createUpload(userId: string, clubId: string, input: Record<string, unknown>) {
    if (!(typeof input.mediaType === 'string' && Object.hasOwn(MEDIA_RULES, input.mediaType))) throw new AnnouncementError(400, 'Unsupported attachment type.');
    const kind = input.mediaType as MediaKind;
    if (typeof input.filename !== 'string' || input.filename.length > 180 || /[\u0000-\u001f]/.test(input.filename) || typeof input.mimeType !== 'string' || typeof input.bytes !== 'number') throw new AnnouncementError(400, 'Invalid file metadata.');
    try { validateSelectedFile({ type: input.mimeType, size: input.bytes, name: input.filename }, kind, configuredMediaLimit(kind)); }
    catch (error) { throw new AnnouncementError(400, (error as Error).message); }
    let config;
    try { config = assertCloudinaryConfigured(); }
    catch { throw new AnnouncementError(503, 'Media uploads are not configured yet. You can still publish text announcements.'); }
    const id = crypto.randomUUID();
    const rule = MEDIA_RULES[kind];
    const publicId = `clubs/${clubId}/announcements/${id}/${crypto.randomUUID()}${kind === 'pdf' ? '.pdf' : ''}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number | boolean> = {
        timestamp, public_id: publicId, overwrite: false, type: 'authenticated',
        context: `announcement_upload=${id}|club=${clubId}|uploader=${userId}`,
    };
    if (kind !== 'pdf') params.allowed_formats = rule.formats.join(',');
    // Bound image delivery size at ingestion; feed never downloads a full-resolution original.
    if (kind === 'image') params.transformation = 'c_limit,w_1600,h_1600/q_auto:good';
    await pool.query(`INSERT INTO club_announcement_assets(id,club_id,uploader_id,public_id,resource_type,media_type,filename,mime_type,bytes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, clubId, userId, publicId, rule.resourceType, kind, input.filename, input.mimeType, input.bytes]);
    const fields: Record<string, string | number | boolean> = { ...params, api_key: config.apiKey, signature: cloudinary.utils.api_sign_request(params, config.apiSecret) };
    return { id, uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/${rule.resourceType}/upload`, fields, maxBytes: configuredMediaLimit(kind), finalizeWithinSeconds: 900 };
}
export function verifyAssetMetadata(remote: Record<string, unknown>, row: Record<string, unknown>) {
    const kind = row.media_type as MediaKind;
    const rule = MEDIA_RULES[kind];
    const context = (remote.context as { custom?: Record<string, string> } | undefined)?.custom;
    const format = kind === 'pdf' ? 'pdf' : String(remote.format || '').toLowerCase();
    if (remote.public_id !== row.public_id || remote.resource_type !== row.resource_type || remote.type !== 'authenticated' ||
        context?.announcement_upload !== row.id || context?.club !== row.club_id || context?.uploader !== row.uploader_id ||
        !rule.formats.includes(format) || !Number.isSafeInteger(remote.bytes) || Number(remote.bytes) <= 0 || Number(remote.bytes) > configuredMediaLimit(kind) ||
        (kind !== 'image' && Number(remote.bytes) !== Number(row.bytes))) {
        throw new AnnouncementError(400, 'Uploaded asset does not match its authorized upload.');
    }
    if (kind === 'video' && (remote.is_audio === true || !(Number(remote.width) > 0 && Number(remote.height) > 0))) throw new AnnouncementError(400, 'Select an actual video file.');
    if (kind === 'audio' && remote.is_audio === false) throw new AnnouncementError(400, 'Select an actual audio file.');
    return { format, bytes: Number(remote.bytes) };
}
async function verifyPdf(publicId: string) {
    const url = cloudinary.utils.private_download_url(publicId, '', { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: false });
    const response = await fetch(url, { headers: { Range: 'bytes=0-15' }, signal: AbortSignal.timeout(10000) });
    const reader = response.body?.getReader();
    if (!response.ok || !reader) throw new AnnouncementError(502, 'Could not verify the PDF. Please retry.');
    let prefix = '';
    try {
        while (prefix.length < 5) {
            const chunk = await reader.read();
            if (chunk.done) break;
            prefix += new TextDecoder().decode(chunk.value.subarray(0, 16));
        }
    } finally { await reader.cancel(); }
    if (!prefix.startsWith('%PDF-')) throw new AnnouncementError(400, 'The uploaded file is not a valid PDF.');
}
export async function completeUpload(userId: string, id: string) {
    const row = (await pool.query(`SELECT * FROM club_announcement_assets WHERE id=$1 AND uploader_id=$2 AND announcement_id IS NULL
        AND state IN ('pending','verified') AND finalize_until>NOW()`, [id, userId])).rows[0];
    if (!row) throw new AnnouncementError(404, 'Upload is unavailable or has expired. Select the file again.');
    assertCloudinaryConfigured();
    let remote;
    try { remote = await cloudinary.api.resource(row.public_id, { resource_type: row.resource_type, type: 'authenticated', context: true }); }
    catch { throw new AnnouncementError(502, 'Upload is not available for verification yet. Please retry.'); }
    const verified = verifyAssetMetadata(remote, row);
    if (row.media_type === 'pdf') await verifyPdf(row.public_id);
    return transaction(async client => {
        const result = await client.query(`UPDATE club_announcement_assets SET state='verified', finalize_until=NOW()+INTERVAL '70 minutes', expires_at=NOW()+INTERVAL '70 minutes', bytes=$3, format=$4, width=$5, height=$6, duration=$7, version=$8
            WHERE id=$1 AND uploader_id=$2 AND announcement_id IS NULL AND state IN ('pending','verified') AND finalize_until>NOW() RETURNING *`,
            [id, userId, verified.bytes, verified.format, remote.width || null, remote.height || null, remote.duration || null, remote.version]);
        if (!result.rows[0]) throw new AnnouncementError(409, 'Upload was cancelled or expired.');
        return serializeAsset(result.rows[0]);
    });
}
export async function discardUpload(userId: string, id: string) {
    // Keep the cleanup intent longer than Cloudinary's signature window, including cancelled/in-flight uploads.
    await pool.query(`UPDATE club_announcement_assets SET finalize_until=NOW(),expires_at=GREATEST(expires_at,NOW()+INTERVAL '70 minutes')
        WHERE id=$1 AND uploader_id=$2 AND announcement_id IS NULL AND state IN ('pending','verified')`, [id, userId]);
}
