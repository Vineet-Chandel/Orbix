import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
const databaseUrl = process.env.ANNOUNCEMENTS_TEST_DATABASE_URL;
test('PostgreSQL publication, permissions, cursor stability and concurrent engagement', { skip: !databaseUrl }, async t => {
    const parsed = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !/^\/orbix_announcements_test(?:_|$)/.test(parsed.pathname)) throw new Error('Integration tests require a local database named orbix_announcements_test or orbix_announcements_test_*.');
    const schema = `announcements_test_${crypto.randomUUID().replaceAll('-', '')}`;
    const setup = new pg.Pool({ connectionString: databaseUrl });
    let applicationPool: pg.Pool | undefined;
    try {
        await setup.query(`CREATE SCHEMA "${schema}"`);
        const client = await setup.connect();
        try {
            await client.query(`SET search_path TO "${schema}"`);
            await client.query(`CREATE TABLE users(id UUID PRIMARY KEY, username TEXT);
                CREATE TABLE verified_clubs(id UUID PRIMARY KEY, auth_user_id UUID, name TEXT, slug TEXT, logo_url TEXT, college_id UUID, is_active BOOLEAN DEFAULT true,
                    visibility TEXT DEFAULT 'public', publication_status TEXT DEFAULT 'published', profile_visibility TEXT DEFAULT 'public');
                CREATE TABLE club_memberships(club_id UUID,user_id UUID,status TEXT,access_role TEXT);
                CREATE TABLE club_team_members(club_id UUID,user_id UUID,status TEXT);
                CREATE TABLE club_coordinators(club_id UUID,linked_user_id UUID);
                CREATE TABLE team_workspaces(id UUID PRIMARY KEY,club_id UUID,workspace_status TEXT);
                CREATE TABLE workspace_roles(id UUID PRIMARY KEY,slug TEXT);
                CREATE TABLE workspace_members(workspace_id UUID,user_id UUID,membership_status TEXT,is_suspended BOOLEAN DEFAULT false,role_id UUID);`);
            const migration = await fs.readFile(new URL('../../database/migrations/068_club_announcements.sql', import.meta.url), 'utf8');
            await client.query(migration.replaceAll('public.', `"${schema}".`));
        } finally { client.release(); }
        for (const key of ['NODE_ENV', 'ORBIX_ENV', 'APP_ENV', 'TARGET_ENV']) process.env[key] = 'test';
        parsed.searchParams.set('options', `-csearch_path=${schema}`);
        process.env.SUPABASE_DB_URL = process.env.DATABASE_URL = parsed.toString();
        const { pool } = await import('../../database/client.js');
        applicationPool = pool;
        const repo = await import('./announcementRepository.js');
        const { parseCursor } = await import('./announcementPolicy.js');
        const ids = Array.from({ length: 9 }, () => crypto.randomUUID());
        const [owner, author, peer, outsider, club, campusPeerClub, otherCampusClub, college, otherCollege] = ids as [string,string,string,string,string,string,string,string,string];
        for (const [id, name] of [[owner,'owner'],[author,'author'],[peer,'peer'],[outsider,'outsider']] as const) await pool.query('INSERT INTO users(id,username) VALUES($1,$2)', [id,name]);
        for (const [id, userId, collegeId, name] of [[club,owner,college,'Club A'],[campusPeerClub,peer,college,'Club B'],[otherCampusClub,outsider,otherCollege,'Club C']] as const) {
            await pool.query('INSERT INTO verified_clubs(id,auth_user_id,college_id,name,slug) VALUES($1,$2,$3,$4,$5)', [id,userId,collegeId,name,name.replaceAll(' ','-')]);
        }
        await pool.query("INSERT INTO club_memberships(club_id,user_id,status,access_role) VALUES($1,$2,'active','member')", [club,author]);
        const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A real database test' }] }] };
        const input = { content, plainText: 'A real database test', assetIds: [], status: 'published' };
        let post = '';
        await t.test('active members publish and duplicate submissions return one row', async () => {
            await repo.requireClub(author, club);
            const requestId = crypto.randomUUID();
            const results = await Promise.all(Array.from({ length: 8 }, () => repo.writeAnnouncement(author, club, requestId, input)));
            assert.equal(new Set(results).size, 1);
            post = results[0]!;
            assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM club_announcements WHERE client_request_id=$1', [requestId])).rows[0].count, 1);
        });
        await t.test('same-campus readers can read but cannot edit and outsiders cannot read', async () => {
            assert.equal((await repo.fetchOne(peer, post)).id, post);
            await assert.rejects(repo.writeAnnouncement(peer, club, crypto.randomUUID(), input, post));
            await assert.rejects(repo.fetchOne(outsider, post));
            await assert.rejects(repo.requireClub(outsider, club));
        });
        await t.test('concurrent repeated likes and unlikes stay unique and accurate', async () => {
            const likes = await Promise.all(Array.from({ length: 20 }, () => repo.setLike(peer, post, true)));
            assert.ok(likes.every(result => result.likeCount === 1));
            assert.equal((await repo.setLike(author, post, true)).likeCount, 2);
            const unlikes = await Promise.all(Array.from({ length: 20 }, () => repo.setLike(peer, post, false)));
            assert.ok(unlikes.every(result => result.likeCount === 1));
            assert.equal((await repo.setLike(author, post, false)).likeCount, 0);
        });
        await t.test('composite cursors survive timestamp ties, new insertions and a deleted anchor', async () => {
            for (let index=0;index<24;index++) await pool.query(`INSERT INTO club_announcements(club_id,author_id,content,plain_text,status,client_request_id,created_at)
                VALUES($1,$2,$3,$4,'published',$5,'2020-01-01 00:00:00.123456+00')`, [club,author,JSON.stringify(content),`Seed ${index}`,crypto.randomUUID()]);
            const context = await repo.requireClub(author, club);
            const first = await repo.fetchPage(author, context, 'mine', 10, null);
            const seen = first.rows.map(row => row.id);
            const firstCursor = first.pagination.nextCursor!;
            await repo.removeAnnouncement(author, first.rows.at(-1)!.id);
            const insertedLater = await repo.writeAnnouncement(author, club, crypto.randomUUID(), input);
            let cursor: string | null = firstCursor;
            while(cursor) {
                const page = await repo.fetchPage(author, context, 'mine', 10, parseCursor(cursor));
                seen.push(...page.rows.map(row => row.id));
                cursor = page.pagination.nextCursor;
            }
            assert.equal(new Set(seen).size, 25);
            assert.equal(seen.length, 25);
            assert.ok(!seen.includes(insertedLater));
        });
        await t.test('private club posts and private drafts do not leak through permalinks', async () => {
            await pool.query("UPDATE verified_clubs SET visibility='private',profile_visibility='private' WHERE id=$1", [club]);
            await assert.rejects(repo.fetchOne(peer, post));
            assert.equal((await repo.fetchOne(author, post)).id, post);
            await pool.query("UPDATE verified_clubs SET visibility='public',profile_visibility='public' WHERE id=$1", [club]);
            const draft = await repo.writeAnnouncement(author, club, crypto.randomUUID(), { ...input, status: 'draft' });
            await assert.rejects(repo.fetchOne(peer, draft));
            await assert.rejects(repo.setLike(author, draft, true));
        });
        await t.test('soft-deleted posts cannot be read or liked', async () => {
            await repo.removeAnnouncement(author, post);
            await assert.rejects(repo.fetchOne(author, post));
            await assert.rejects(repo.setLike(peer, post, true));
        });
    } finally {
        await applicationPool?.end();
        await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await setup.end();
    }
});
