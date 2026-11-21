import test from 'node:test';
import assert from 'node:assert/strict';
for (const key of ['NODE_ENV', 'ORBIX_ENV', 'APP_ENV', 'TARGET_ENV']) process.env[key] = 'test';
process.env.SUPABASE_DB_URL = process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/orbix_announcements_unit_test';
const { pool } = await import('../../database/client.js');
const repository = await import('./announcementRepository.js');
const { EMPTY_DOCUMENT } = await import('../../../../shared/announcements.js');
const postId = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000002';
const input = { content: EMPTY_DOCUMENT, plainText: '', assetIds: [requestId], status: 'published' };
function mockTransaction(row: Record<string, unknown> | null, assets: Record<string, unknown>[] = []) {
    const statements: string[] = [];
    let released = false;
    const mock = test.mock.method(pool, 'connect', async () => ({
        query: async (sql: string) => {
            statements.push(sql);
            if (sql.includes('SELECT a.*')) return { rows: row ? [row] : [] };
            if (sql.includes('INSERT INTO club_announcements')) return { rows: [{ id: postId }] };
            if (sql.includes('SELECT id, uploader_id')) return { rows: assets };
            return { rows: [] };
        }, release: () => { released = true; },
    }));
    return { statements, get released() { return released; }, restore: () => mock.mock.restore() };
}
test('inactive or unrelated users cannot acquire a publishing club', async () => {
    const mock = test.mock.method(pool, 'query', async () => ({ rows: [] }));
    try { await assert.rejects(repository.requireClub('outsider', 'club'), /Active club membership/); }
    finally { mock.mock.restore(); }
});
test('editing another author’s post is denied and the transaction rolls back', async () => {
    const mock = mockTransaction({ isMember: true, canManage: false, club_id: 'club' });
    try {
        await assert.rejects(repository.writeAnnouncement('outsider', 'club', requestId, input, postId), /Only the author/);
        assert.equal(mock.statements.some(sql => sql.startsWith('UPDATE club_announcements')), false);
        assert.equal(mock.statements.at(-1), 'ROLLBACK');
        assert.equal(mock.released, true);
    } finally { mock.restore(); }
});
test('removal after membership revocation is denied even for the original author', async () => {
    const mock = mockTransaction({ isMember: false, canManage: true, club_id: 'club' });
    try { await assert.rejects(repository.removeAnnouncement('former-author', postId), /Only the author/); assert.equal(mock.statements.at(-1), 'ROLLBACK'); }
    finally { mock.restore(); }
});
test('publication with an unverified or foreign asset rolls back the announcement insert', async () => {
    const mock = mockTransaction(null, [{ id: requestId, state: 'verified', unexpired: true, uncancelled: true, uploader_id: 'another-user', announcement_id: null }]);
    try {
        await assert.rejects(repository.writeAnnouncement('publisher', 'club', requestId, input), /another publisher/);
        assert.equal(mock.statements.at(-1), 'ROLLBACK');
        assert.equal(mock.statements.some(sql => sql.includes('INSERT INTO club_announcement_jobs')), false);
    } finally { mock.restore(); }
});
test('inaccessible announcements cannot receive likes', async () => {
    const mock = mockTransaction(null);
    try { await assert.rejects(repository.setLike('outsider', postId, true), /unavailable/); assert.equal(mock.statements.some(sql => sql.includes('INSERT INTO club_announcement_likes')), false); }
    finally { mock.restore(); }
});
test('draft engagement is rejected without a like write', async () => {
    const mock = mockTransaction({ status: 'draft' });
    try { await assert.rejects(repository.setLike('author', postId, true), /Only published/); assert.equal(mock.statements.some(sql => sql.includes('INSERT INTO club_announcement_likes')), false); }
    finally { mock.restore(); }
});
test.after(async () => { await pool.end(); });
