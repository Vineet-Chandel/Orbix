import { WorkspaceRecognitionController } from "../controllers/workspace/workspaceRecognitionController.js";
import { getStaffAllowlist } from "./staff.middleware.js";
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../database/client.js';
import redis from '../redis/client.js';
import { publicAnalyticsPrivacy } from './publicAnalyticsPrivacy.middleware.js';
import { handleGetPublicProfile, handlePrivacyAudit } from '../Routes/profile/profile.js';
import { handleGetPublicResume, handleStreamResume } from '../Routes/profile/resume.js';
import { ClubProfileService } from '../services/club/clubProfileService.js';
import { ClubTeamService } from '../services/club/clubTeamService.js';

const originalQuery = pool.query;
const originalGet = redis.get;
const originalPermissions = ClubTeamService.resolveUserClubPermissions;
let visible = true, blocked = false, hiddenPlatform = false, cacheReads = 0;
let queries: Array<{ sql: string; values: any[] }> = [];
beforeEach(() => {
    ClubTeamService.resolveUserClubPermissions = originalPermissions;
    redis.disconnect();
    (redis as any).status = 'ready';
    visible = true; blocked = false; hiddenPlatform = false; cacheReads = 0; queries = [];
    (redis as any).get = async () => { cacheReads++; return JSON.stringify({ username: 'coder', isPublic: true, platforms: [] }); };
    (pool as any).query = async (sql: string, values: any[] = []) => {
        queries.push({ sql, values });
        if (sql.includes('FROM user_blocks')) return { rows: blocked ? [{ blocker_id: 'viewer', blocked_id: 'target' }] : [] };
        if (sql.includes('FROM user_links')) return { rows: hiddenPlatform ? [{ exists: 1 }] : [] };
        if (sql.includes('FROM users')) return { rowCount: 1, rows: [{ id: 'target', username: 'coder', is_public: visible, isPublic: visible, isResumePublic: true, resumeUrl: 'https://example.com/private.pdf' }] };
        return { rows: [], rowCount: 0 };
    };
});
after(async () => {
    (pool as any).query = originalQuery;
    (redis as any).get = originalGet;
    ClubTeamService.resolveUserClubPermissions = originalPermissions;
    redis.disconnect(); await pool.end();
});
function response() {
    const res: any = { statusCode: 200, payload: null,
        status(code: number) { this.statusCode = code; return this; },
        json(body: any) { this.payload = body; return this; },
    };
    return res;
}
test('a newly private profile cannot be read from a previously public cache', async () => {
    visible = false;
    const res = response();
    await handleGetPublicProfile({ params: { username: 'coder' } } as any, res);
    assert.equal(res.statusCode, 404); assert.equal(cacheReads, 0);
});
test('blocked viewers cannot read a cached public profile', async () => {
    blocked = true;
    const res = response();
    await handleGetPublicProfile({ params: { username: 'coder' }, user: { id: 'viewer', username: 'visitor' } } as any, res);
    assert.equal(res.statusCode, 403); assert.equal(cacheReads, 0);
});
test('public profile cache remains usable after current visibility checks', async () => {
    const res = response();
    await handleGetPublicProfile({ params: { username: 'coder' } } as any, res);
    assert.equal(res.statusCode, 200); assert.equal(res.payload.profile.isOwner, false); assert.equal(cacheReads, 1);
    assert.ok(queries[0]?.sql.includes('FROM users'));
});
test('privacy diagnostics reject another viewer before querying private scores', async () => {
    const res = response();
    await handlePrivacyAudit({ params: { username: 'coder' }, user: { username: 'visitor' } } as any, res);
    assert.equal(res.statusCode, 403); assert.equal(queries.length, 0);
});
test('private profiles and mixed-visibility aggregates cannot reach analytics caches', async () => {
    const req: any = { query: { username: 'coder' } };
    let called = false;
    visible = false;
    let res = response();
    await publicAnalyticsPrivacy(req, res, () => { called = true; });
    assert.equal(res.statusCode, 404); assert.equal(called, false);
    visible = true; hiddenPlatform = true; res = response();
    await publicAnalyticsPrivacy(req, res, () => { called = true; });
    assert.equal(res.statusCode, 403); assert.equal(called, false);
});
test('owners can load private analytics while blocked visitors cannot', async () => {
    visible = false;
    let called = false;
    await publicAnalyticsPrivacy({ query: { username: 'coder' }, user: { id: 'target' } } as any, response(), () => { called = true; });
    assert.equal(called, true);
    visible = true; blocked = true; called = false;
    const res = response();
    await publicAnalyticsPrivacy({ query: { username: 'coder' }, user: { id: 'viewer' } } as any, res, () => { called = true; });
    assert.equal(res.statusCode, 404); assert.equal(called, false);
});
test('a query-supplied club ID does not grant preview access to a draft club', async () => {
    ClubTeamService.resolveUserClubPermissions = async () => null;
    await ClubProfileService.getCollegeClubs('viewer', { collegeName: 'Example Campus', clubId: 'private-club' });
    const directory = queries.find(q => q.sql.includes('FROM verified_clubs vc'));
    assert.ok(directory); assert.equal(directory.values[2], null);
});
test('resume metadata and streaming deny blocked viewers before cache or storage access', async () => {
    blocked = true;
    const req: any = { params: { username: 'coder' }, query: {}, user: { id: 'viewer' } };
    const meta = response(); await handleGetPublicResume(req, meta);
    assert.equal(meta.statusCode, 404);
    const stream = response(); await handleStreamResume(req, stream);
    assert.equal(stream.statusCode, 404); assert.equal(cacheReads, 0);
});


test('inactive memberships cannot confer club management permissions', async () => {
    (pool as any).query = async (sql: string) => {
        if (sql.includes('FROM public.verified_clubs')) return { rows: [{ id: 'club', auth_user_id: 'another-owner', name: 'Club', slug: 'club' }] };
        if (sql.includes('FROM public.club_memberships')) return { rows: sql.includes("status = 'active'") ? [] : [{ club_role: 'admin', status: 'inactive' }] };
        return { rows: [] };
    };
    const permissions = await ClubTeamService.resolveUserClubPermissions('viewer', 'club');
    assert.equal(permissions?.isAdmin, false);
    assert.equal(permissions?.userRole, 'none');
});


test('staff email grants require explicit server configuration', () => {
    const staff = process.env.ORBIX_STAFF_EMAILS;
    const reviewers = process.env.ORBIX_REVIEWER_EMAILS;
    try {
        process.env.ORBIX_STAFF_EMAILS = '';
        process.env.ORBIX_REVIEWER_EMAILS = 'reviewer@example.test';
        assert.deepEqual(getStaffAllowlist(), []);
        process.env.ORBIX_STAFF_EMAILS = 'operator@example.test';
        assert.deepEqual(getStaffAllowlist(), ['operator@example.test']);
    } finally {
        if (staff === undefined) delete process.env.ORBIX_STAFF_EMAILS; else process.env.ORBIX_STAFF_EMAILS = staff;
        if (reviewers === undefined) delete process.env.ORBIX_REVIEWER_EMAILS; else process.env.ORBIX_REVIEWER_EMAILS = reviewers;
    }
});


test('recognition summaries reject a request for a different member before querying', async () => {
    const res = response();
    await WorkspaceRecognitionController.getSummary({
        user: { id: 'viewer' },
        params: { workspaceId: 'workspace-id' },
        query: { userId: 'target' },
    } as any, res);
    assert.equal(res.statusCode, 403);
    assert.equal(queries.length, 0);
});
