import test from 'node:test';
import assert from 'node:assert/strict';
// Fail closed: these tests never connect to a configured application database.
for (const key of ['NODE_ENV', 'ORBIX_ENV', 'APP_ENV', 'TARGET_ENV']) process.env[key] = 'test';
process.env.SUPABASE_DB_URL = process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/orbix_announcements_unit_test';
process.env.CLOUDINARY_CLOUD_NAME = 'announcement-test-cloud';
process.env.CLOUDINARY_API_KEY = 'unit-test-key';
process.env.CLOUDINARY_API_SECRET = 'unit-test-secret';
const { createUpload, verifyAssetMetadata, serializeAsset } = await import('./announcementMediaService.js');
const { pool } = await import('../../database/client.js');
const { cloudinary } = await import('../../config/cloudinary.js');
const fixture = () => ({ id: 'intent-id', public_id: 'clubs/club-id/announcements/intent-id/asset', club_id: 'club-id', uploader_id: 'user-id', media_type: 'video', resource_type: 'video', bytes: 1000 });
const remote = () => ({ public_id: fixture().public_id, resource_type: 'video', type: 'authenticated', format: 'mp4', bytes: 1000, width: 1280, height: 720, context: { custom: { announcement_upload: 'intent-id', club: 'club-id', uploader: 'user-id' } } });
test('verifies Cloudinary ownership, resource type, delivery type and actual size', () => {
    assert.deepEqual(verifyAssetMetadata(remote(), fixture()), { format: 'mp4', bytes: 1000 });
    for (const override of [{ public_id: 'someone-elses-asset' }, { type: 'upload' }, { resource_type: 'image' }, { bytes: 999999999 }, { bytes: 5 }, { format: 'exe' }, { context: { custom: { uploader: 'another-user' } } }]) {
        assert.throws(() => verifyAssetMetadata({ ...remote(), ...override }, fixture()));
    }
});
test('signs controlled, non-overwriting authenticated uploads without exposing the secret', async () => {
    const queryMock = test.mock.method(pool, 'query', async () => ({ rows: [] }));
    try {
        const result = await createUpload('user-id', 'club-id', { mediaType: 'image', filename: 'event.png', mimeType: 'image/png', bytes: 1000 });
        const { api_key: apiKey, signature, ...signed } = result.fields;
        assert.equal(apiKey, 'unit-test-key');
        assert.equal(signature, cloudinary.utils.api_sign_request(signed, 'unit-test-secret'));
        assert.equal(result.fields.type, 'authenticated');
        assert.equal(result.fields.overwrite, false);
        assert.match(String(result.fields.public_id), /^clubs\/club-id\/announcements\//);
        assert.match(String(result.fields.transformation), /1600/);
        assert.ok(result.uploadUrl.endsWith('/image/upload'));
        assert.ok(!JSON.stringify(result).includes('unit-test-secret'));
    } finally { queryMock.mock.restore(); }
});
test('PDF and audio use their intended Cloudinary resource types', async () => {
    const queryMock = test.mock.method(pool, 'query', async () => ({ rows: [] }));
    try {
        const pdf = await createUpload('u', 'c', { mediaType: 'pdf', filename: 'notes.pdf', mimeType: 'application/pdf', bytes: 200 });
        const audio = await createUpload('u', 'c', { mediaType: 'audio', filename: 'speech.mp3', mimeType: 'audio/mpeg', bytes: 200 });
        assert.ok(pdf.uploadUrl.endsWith('/raw/upload'));
        assert.ok(String(pdf.fields.public_id).endsWith('.pdf'));
        assert.ok(audio.uploadUrl.endsWith('/video/upload'));
        await assert.rejects(createUpload('u', 'c', { mediaType: '__proto__' }));
    } finally { queryMock.mock.restore(); }
});
test('original delivery URLs are signed, authenticated and expire', () => {
    const asset = serializeAsset({ ...fixture(), id: 'asset', resource_type: 'video', media_type: 'audio', filename: 'speech.mp3', mime_type: 'audio/mpeg', format: 'mp3', announcement_id: null });
    const url = new URL(asset.url);
    assert.equal(url.searchParams.get('type'), 'authenticated');
    assert.ok(Number(url.searchParams.get('expires_at')) > Date.now() / 1000);
    assert.ok(url.searchParams.get('signature'));
    assert.equal(asset.mediaType, 'audio');
});
test.after(async () => { await pool.end(); });
test('image CDN variants use signed URLs, automatic format and quality', () => {
    const asset = serializeAsset({ ...fixture(), id: 'asset', resource_type: 'image', media_type: 'image', filename: 'photo.png', mime_type: 'image/png', format: 'png', announcement_id: null });
    assert.match(asset.url, /image\/authenticated\/s--/);
    assert.match(asset.url, /f_auto/);
    assert.match(asset.url, /q_auto/);
    for (const width of [480, 960, 1600]) assert.ok(asset.srcSet?.includes(`${width}w`));
    assert.ok(new URL(asset.downloadUrl!).searchParams.get('expires_at'));
});
