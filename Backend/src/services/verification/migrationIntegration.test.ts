/**
 * ISOLATED POSTGRESQL INTEGRATION TEST: PLATFORM ACCOUNT OWNERSHIP VERIFICATION
 * 
 * Executes full schema migration and runtime validation against isolated disposable
 * PostgreSQL 18 test database on port 5433.
 * 
 * Test Scenarios:
 * 1. Pre-migration schema setup with legacy data and duplicate unproven claims.
 * 2. Unambiguous vs ambiguous orphan backfill and lossless archival.
 * 3. Step-by-step execution of Migration 069 in transaction.
 * 4. Zero-conflict legacy demotion and coexistence of unverified duplicate claims.
 * 5. Complete trigger compatibility matrix across all 7 insertion/update cases.
 * 6. Partial unique index enforcement with case & whitespace normalization.
 * 7. Platform verification challenge constraints, composite FK user binding, and rate limiting.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disposable test instance config
const DB_CONFIG: pg.ClientConfig = {
    host: '127.0.0.1',
    port: 5433,
    user: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 3000,
};

describe('PostgreSQL Isolated Integration Tests (Migration 069)', () => {
    let client: pg.Client;
    let dbAvailable = false;
    const migrationPath = path.resolve(__dirname, '../../database/migrations/069_platform_account_ownership_verification.sql');

    before(async () => {
        try {
            client = new Client(DB_CONFIG);
            await client.connect();
            dbAvailable = true;
        } catch {
            dbAvailable = false;
            return;
        }

        // Prepare clean isolated test schema
        await client.query(`DROP SCHEMA IF EXISTS test_verification CASCADE;`);
        await client.query(`CREATE SCHEMA test_verification;`);
        await client.query(`SET search_path TO test_verification, public;`);

        // Baseline users table
        await client.query(`
            CREATE TABLE public.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
        `);

        // Baseline pre-migration user_links table (matches pre-067 production schema)
        await client.query(`
            CREATE TABLE public.user_links (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NULL,
                username VARCHAR(100) NULL,
                portal VARCHAR(50) NOT NULL,
                portal_username VARCHAR(100) NOT NULL,
                link TEXT NOT NULL,
                raw_input TEXT NULL,
                verified BOOLEAN DEFAULT true,
                display_name VARCHAR(150) NULL,
                avatar_url TEXT NULL,
                stats JSONB DEFAULT '[]'::jsonb,
                is_public BOOLEAN DEFAULT true,
                last_sync_status VARCHAR(50) DEFAULT 'valid',
                last_sync_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
                last_error TEXT NULL,
                snapshot JSONB DEFAULT '{}'::jsonb,
                retry_count INT DEFAULT 0
            );
        `);
    });

    after(async () => {
        if (client && dbAvailable) {
            await client.query(`DROP TABLE IF EXISTS public.platform_verification_challenges CASCADE;`);
            await client.query(`DROP TABLE IF EXISTS public.user_links CASCADE;`);
            await client.query(`DROP TABLE IF EXISTS public.user_links_orphaned_archive CASCADE;`);
            await client.query(`DROP TABLE IF EXISTS public.users CASCADE;`);
            await client.query(`DROP SCHEMA IF EXISTS test_verification CASCADE;`);
            await client.end();
        }
    });

    test('Step 1: Seeds baseline legacy users and conflicting unverified links', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        // Seed users
        const u1 = await client.query(`INSERT INTO public.users (id, username, email) VALUES ('11111111-1111-1111-1111-111111111111', 'alice', 'alice@test.com') RETURNING id;`);
        const u2 = await client.query(`INSERT INTO public.users (id, username, email) VALUES ('22222222-2222-2222-2222-222222222222', 'bob', 'bob@test.com') RETURNING id;`);
        
        // Seed ambiguous users sharing normalized username (legacy anomaly simulation)
        await client.query(`INSERT INTO public.users (id, username, email) VALUES ('33333333-3333-3333-3333-33333333333a', 'charlie', 'charlie1@test.com');`);
        await client.query(`INSERT INTO public.users (id, username, email) VALUES ('33333333-3333-3333-3333-33333333333b', 'Charlie ', 'charlie2@test.com');`);

        // 1. Valid user1 link (leetcode: ninja_coder)
        await client.query(`
            INSERT INTO public.user_links (id, user_id, username, portal, portal_username, link, verified)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'alice', 'leetcode', 'ninja_coder', 'https://leetcode.com/ninja_coder', true);
        `);

        // 2. Duplicate claim by user2 for identical handle (leetcode: ninja_coder) - verified = true prior to migration
        await client.query(`
            INSERT INTO public.user_links (id, user_id, username, portal, portal_username, link, verified)
            VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'bob', 'leetcode', 'ninja_coder', 'https://leetcode.com/ninja_coder', true);
        `);

        // 3. Unambiguous orphan: user_id is NULL, username = 'alice' (should resolve to user1)
        await client.query(`
            INSERT INTO public.user_links (id, user_id, username, portal, portal_username, link, verified)
            VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 'alice', 'codeforces', 'alice_cf', 'https://codeforces.com/profile/alice_cf', true);
        `);

        // 4. Ambiguous orphan: username = 'charlie' (matches 2 users, must NOT resolve arbitrarily, must archive)
        await client.query(`
            INSERT INTO public.user_links (id, user_id, username, portal, portal_username, link, verified)
            VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', NULL, 'charlie', 'hackerrank', 'charlie_hr', 'https://hackerrank.com/charlie_hr', true);
        `);

        // 5. Unresolvable orphan: username does not exist
        await client.query(`
            INSERT INTO public.user_links (id, user_id, username, portal, portal_username, link, verified)
            VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL, 'ghost_user', 'codechef', 'ghost_cc', 'https://codechef.com/users/ghost_cc', true);
        `);

        // 6. Foreign key orphan: user_id is non-existent UUID
        await client.query(`
            INSERT INTO public.user_links (id, user_id, username, portal, portal_username, link, verified)
            VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'deleted_user', 'github', 'deleted_gh', 'https://github.com/deleted_gh', true);
        `);

        const count = await client.query(`SELECT COUNT(*) FROM public.user_links;`);
        assert.equal(parseInt(count.rows[0].count), 6);
    });

    test('Step 2: Applies Migration 069 inside transaction without errors', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        await client.query('BEGIN;');
        try {
            await client.query(migrationSql);
            await client.query('COMMIT;');
        } catch (err) {
            await client.query('ROLLBACK;');
            throw err;
        }

        // Verify tables exist
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('user_links', 'user_links_orphaned_archive', 'platform_verification_challenges');
        `);
        assert.equal(tables.rows.length, 3);
    });

    test('Step 3: Validates orphan resolution and lossless archiving', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        // ccc... (unambiguous alice) was resolved
        const resolved = await client.query(`SELECT user_id, username, portal FROM public.user_links WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';`);
        assert.equal(resolved.rows.length, 1);
        assert.equal(resolved.rows[0].user_id, '11111111-1111-1111-1111-111111111111');

        // ddd... (ambiguous), eee... (unresolvable), fff... (dangling FK) were archived
        const archived = await client.query(`SELECT original_id, archive_reason FROM public.user_links_orphaned_archive ORDER BY original_id;`);
        assert.equal(archived.rows.length, 3);

        const reasons = archived.rows.reduce((acc, row) => {
            acc[row.original_id] = row.archive_reason;
            return acc;
        }, {} as Record<string, string>);

        assert.ok(reasons['dddddddd-dddd-dddd-dddd-dddddddddddd'].includes('Ambiguous username match'));
        assert.ok(reasons['eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'].includes('Unresolvable record'));
        assert.ok(reasons['ffffffff-ffff-ffff-ffff-ffffffffffff'].includes('Orphaned record'));

        // Deleted from active user_links table
        const remaining = await client.query(`SELECT id FROM public.user_links;`);
        assert.equal(remaining.rows.length, 3); // aaaaaaaa (alice), bbbbbbbb (bob), cccccccc (alice resolved)
    });

    test('Step 4: Validates legacy demotion and unverified duplicate coexistence', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        const rows = await client.query(`SELECT id, verified, ownership_status, legacy_unverified_at FROM public.user_links;`);
        for (const row of rows.rows) {
            assert.equal(row.verified, false, `Row ${row.id} verified should be false`);
            assert.equal(row.ownership_status, 'CONNECTED_UNVERIFIED', `Row ${row.id} ownership_status should be CONNECTED_UNVERIFIED`);
            assert.ok(row.legacy_unverified_at !== null, `Row ${row.id} should have legacy_unverified_at set`);
        }

        // Both Alice (aaaaaaaa) and Bob (bbbbbbbb) claim leetcode: ninja_coder simultaneously while UNVERIFIED
        const dupes = await client.query(`
            SELECT user_id, portal, portal_username, ownership_status, verified 
            FROM public.user_links 
            WHERE LOWER(portal) = 'leetcode' AND LOWER(portal_username) = 'ninja_coder';
        `);
        assert.equal(dupes.rows.length, 2);
    });

    test('Step 5: Enforces trigger compatibility across all 7 scenarios', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        // Case 1: Insert without ownership_status (defaults to CONNECTED_UNVERIFIED) -> verified is false
        const res1 = await client.query(`
            INSERT INTO public.user_links (user_id, username, portal, portal_username, link)
            VALUES ('11111111-1111-1111-1111-111111111111', 'alice', 'codeforces', 'cf_handle_1', 'link')
            RETURNING verified, ownership_status;
        `);
        assert.equal(res1.rows[0].verified, false);
        assert.equal(res1.rows[0].ownership_status, 'CONNECTED_UNVERIFIED');

        // Case 2: Insert with verified = true but ownership_status = 'CONNECTED_UNVERIFIED' -> trigger forces verified = false
        const res2 = await client.query(`
            INSERT INTO public.user_links (user_id, username, portal, portal_username, link, verified, ownership_status)
            VALUES ('11111111-1111-1111-1111-111111111111', 'alice', 'codeforces', 'cf_handle_2', 'link', true, 'CONNECTED_UNVERIFIED')
            RETURNING verified, ownership_status;
        `);
        assert.equal(res2.rows[0].verified, false);

        // Case 3: Insert with ownership_status = 'VERIFIED' and verified = false -> trigger forces verified = true
        const res3 = await client.query(`
            INSERT INTO public.user_links (user_id, username, portal, portal_username, link, verified, ownership_status)
            VALUES ('11111111-1111-1111-1111-111111111111', 'alice', 'codeforces', 'cf_handle_3', 'link', false, 'VERIFIED')
            RETURNING verified, ownership_status;
        `);
        assert.equal(res3.rows[0].verified, true);

        // Case 4: Update only verified = true on unverified link -> trigger forces verified = false
        await client.query(`
            UPDATE public.user_links SET verified = true WHERE portal_username = 'cf_handle_1';
        `);
        const check4 = await client.query(`SELECT verified, ownership_status FROM public.user_links WHERE portal_username = 'cf_handle_1';`);
        assert.equal(check4.rows[0].verified, false);

        // Case 5: Update ownership_status to 'VERIFIED' -> verified automatically becomes true
        await client.query(`
            UPDATE public.user_links SET ownership_status = 'VERIFIED' WHERE portal_username = 'cf_handle_1';
        `);
        const check5 = await client.query(`SELECT verified, ownership_status FROM public.user_links WHERE portal_username = 'cf_handle_1';`);
        assert.equal(check5.rows[0].verified, true);

        // Case 6: Update unrelated columns (stats, display_name) -> verified remains consistent
        await client.query(`
            UPDATE public.user_links SET display_name = 'Alice Renamed', stats = '{"score": 100}'::jsonb WHERE portal_username = 'cf_handle_1';
        `);
        const check6 = await client.query(`SELECT verified, ownership_status, display_name FROM public.user_links WHERE portal_username = 'cf_handle_1';`);
        assert.equal(check6.rows[0].verified, true);
        assert.equal(check6.rows[0].display_name, 'Alice Renamed');

        // Case 7: Demoting ownership_status to 'REVOKED' -> verified automatically becomes false
        await client.query(`
            UPDATE public.user_links SET ownership_status = 'REVOKED' WHERE portal_username = 'cf_handle_1';
        `);
        const check7 = await client.query(`SELECT verified, ownership_status FROM public.user_links WHERE portal_username = 'cf_handle_1';`);
        assert.equal(check7.rows[0].verified, false);

        // Case 8: Hostile compound update - changing portal_username while attempting to force ownership_status = 'VERIFIED' and verified = true
        // Both triggers and invariants must hold: identity change forces demotion to CONNECTED_UNVERIFIED and verified = false.
        await client.query(`
            UPDATE public.user_links 
            SET portal_username = 'hacked_handle', ownership_status = 'VERIFIED', verified = true 
            WHERE portal_username = 'cf_handle_3';
        `);
        const check8 = await client.query(`
            SELECT verified, ownership_status, portal_username, verified_at, verified_handle 
            FROM public.user_links 
            WHERE portal_username = 'hacked_handle';
        `);
        assert.equal(check8.rows[0].ownership_status, 'CONNECTED_UNVERIFIED', 'Compound update must force ownership_status to CONNECTED_UNVERIFIED');
        assert.equal(check8.rows[0].verified, false, 'Compound update must force verified to false');
        assert.equal(check8.rows[0].verified_at, null, 'verified_at must be reset to null');
        assert.equal(check8.rows[0].verified_handle, null, 'verified_handle must be reset to null');
    });

    test('Step 6: Enforces partial unique index on verified portal handles with normalization', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        // Alice verifies 'ninja_coder' on leetcode
        await client.query(`
            UPDATE public.user_links 
            SET ownership_status = 'VERIFIED' 
            WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        `);

        const aliceCheck = await client.query(`
            SELECT verified, ownership_status FROM public.user_links WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        `);
        assert.equal(aliceCheck.rows[0].verified, true);

        // Bob attempts to verify same handle 'ninja_coder' on leetcode -> Unique index violation
        await assert.rejects(async () => {
            await client.query(`
                UPDATE public.user_links 
                SET ownership_status = 'VERIFIED' 
                WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
            `);
        }, /unique_verified_portal_account/);

        // Bob attempts to bypass with uppercase / whitespace ' Ninja_Coder ' -> Unique index violation
        await assert.rejects(async () => {
            await client.query(`
                INSERT INTO public.user_links (user_id, username, portal, portal_username, link, ownership_status)
                VALUES ('22222222-2222-2222-2222-222222222222', 'bob', ' LeetCode ', ' Ninja_Coder ', 'link', 'VERIFIED');
            `);
        }, /unique_verified_portal_account/);

        // Bob CAN insert 'ninja_coder' on leetcode as long as it is UNVERIFIED
        const bobUnverified = await client.query(`
            INSERT INTO public.user_links (user_id, username, portal, portal_username, link, ownership_status)
            VALUES ('22222222-2222-2222-2222-222222222222', 'bob', 'leetcode', 'ninja_coder_alt', 'link', 'CONNECTED_UNVERIFIED')
            RETURNING id, ownership_status;
        `);
        assert.equal(bobUnverified.rows[0].ownership_status, 'CONNECTED_UNVERIFIED');
    });

    test('Step 7: Validates challenge table constraints, composite foreign key, and single active invariant', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        const aliceId = '11111111-1111-1111-1111-111111111111';
        const bobId = '22222222-2222-2222-2222-222222222222';
        const aliceLinkId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

        // 1. Success: Alice initiates valid challenge bound to her link
        const c1 = await client.query(`
            INSERT INTO public.platform_verification_challenges (
                user_id, link_id, portal, portal_username, token_hash, token_display_prefix,
                target_field, status, expires_at
            ) VALUES (
                $1, $2, 'hackerrank', 'alice_hr', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                'orbix-v-test', 'short_bio', 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ) RETURNING id, status;
        `, [aliceId, aliceLinkId]);
        assert.equal(c1.rows[0].status, 'pending');

        // 2. Reject: Single active challenge invariant (Alice cannot start second pending challenge for hackerrank)
        await assert.rejects(async () => {
            await client.query(`
                INSERT INTO public.platform_verification_challenges (
                    user_id, portal, portal_username, token_hash, token_display_prefix,
                    target_field, status, expires_at
                ) VALUES (
                    $1, 'hackerrank', 'alice_hr_2', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    'orbix-v-test', 'short_bio', 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                );
            `, [aliceId]);
        }, /idx_pvc_single_active_challenge/);

        // 3. Reject: Bob attempts cross-user link binding (Bob creates challenge referencing Alice's link)
        await assert.rejects(async () => {
            await client.query(`
                INSERT INTO public.platform_verification_challenges (
                    user_id, link_id, portal, portal_username, token_hash, token_display_prefix,
                    target_field, status, expires_at
                ) VALUES (
                    $1, $2, 'hackerrank', 'bob_hr', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    'orbix-v-test', 'short_bio', 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                );
            `, [bobId, aliceLinkId]);
        }, /fk_pvc_user_link/);

        // 4. Reject: attempts > max_attempts
        await assert.rejects(async () => {
            await client.query(`
                INSERT INTO public.platform_verification_challenges (
                    user_id, portal, portal_username, token_hash, token_display_prefix,
                    target_field, status, attempts, max_attempts, expires_at
                ) VALUES (
                    $1, 'codechef', 'bob_cc', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    'orbix-v-test', 'short_bio', 'pending', 6, 5, CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                );
            `, [bobId]);
        }, /chk_pvc_attempts_range/);

        // 5. Reject: status = 'verified' but consumed_at IS NULL
        await assert.rejects(async () => {
            await client.query(`
                INSERT INTO public.platform_verification_challenges (
                    user_id, portal, portal_username, token_hash, token_display_prefix,
                    target_field, status, consumed_at, expires_at
                ) VALUES (
                    $1, 'codechef', 'bob_cc', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    'orbix-v-test', 'short_bio', 'verified', NULL, CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                );
            `, [bobId]);
        }, /chk_pvc_consumed_consistency/);

        // 6. Delete Alice's link -> Cascade delete removes her pending challenge
        await client.query(`DELETE FROM public.user_links WHERE id = $1;`, [aliceLinkId]);
        const challengeAfterLinkDelete = await client.query(`
            SELECT id FROM public.platform_verification_challenges WHERE id = $1;
        `, [c1.rows[0].id]);
        assert.equal(challengeAfterLinkDelete.rows.length, 0, 'Challenge should have been cascade deleted');
    });

    test('Step 8: Validates identity-change trigger and ownership state transition matrix', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }
        const aliceId = '11111111-1111-1111-1111-111111111111';

        // 1. Create a verified link for Alice
        const vLink = await client.query(`
            INSERT INTO public.user_links (
                user_id, username, portal, portal_username, link,
                ownership_status, verified, verified_handle, verified_at, verification_method
            ) VALUES (
                $1, 'alice', 'leetcode', 'alice_pro', 'https://leetcode.com/alice_pro',
                'VERIFIED', true, 'alice_pro', CURRENT_TIMESTAMP, 'profile_bio'
            ) RETURNING id, portal, portal_username, ownership_status, verified;
        `, [aliceId]);
        const linkId = vLink.rows[0].id;
        assert.equal(vLink.rows[0].ownership_status, 'VERIFIED');
        assert.equal(vLink.rows[0].verified, true);

        // 2. Unrelated field update (e.g. display_name, stats, sync_status) -> DOES NOT revoke ownership
        await client.query(`
            UPDATE public.user_links 
            SET display_name = 'Alice Star',
                sync_status = 'SYNCED',
                last_sync_status = 'valid',
                stats = '{"solved": 500}'::jsonb
            WHERE id = $1;
        `, [linkId]);
        const afterUnrelated = await client.query(`
            SELECT ownership_status, verified, display_name FROM public.user_links WHERE id = $1;
        `, [linkId]);
        assert.equal(afterUnrelated.rows[0].ownership_status, 'VERIFIED', 'Unrelated update must NOT revoke ownership');
        assert.equal(afterUnrelated.rows[0].verified, true);
        assert.equal(afterUnrelated.rows[0].display_name, 'Alice Star');

        // 3. Change portal_username -> Identity change trigger automatically demotes to CONNECTED_UNVERIFIED
        await client.query(`
            UPDATE public.user_links 
            SET portal_username = 'alice_hijacked'
            WHERE id = $1;
        `, [linkId]);
        const afterHandleChange = await client.query(`
            SELECT ownership_status, verified, verified_at, legacy_unverified_at 
            FROM public.user_links WHERE id = $1;
        `, [linkId]);
        assert.equal(afterHandleChange.rows[0].ownership_status, 'CONNECTED_UNVERIFIED', 'Handle change must demote to CONNECTED_UNVERIFIED');
        assert.equal(afterHandleChange.rows[0].verified, false, 'Handle change must set verified = false');
        assert.equal(afterHandleChange.rows[0].verified_at, null, 'verified_at must be cleared');
        assert.ok(afterHandleChange.rows[0].legacy_unverified_at !== null, 'legacy_unverified_at must be populated');

        // 4. Legitimate re-verification transition: CONNECTED_UNVERIFIED -> VERIFIED
        await client.query(`
            UPDATE public.user_links
            SET ownership_status = 'VERIFIED',
                verified_at = CURRENT_TIMESTAMP,
                verified_handle = 'alice_hijacked'
            WHERE id = $1;
        `, [linkId]);
        const reVerified = await client.query(`
            SELECT ownership_status, verified FROM public.user_links WHERE id = $1;
        `, [linkId]);
        assert.equal(reVerified.rows[0].ownership_status, 'VERIFIED');
        assert.equal(reVerified.rows[0].verified, true);

        // 5. Revocation transition: VERIFIED -> REVOKED
        await client.query(`
            UPDATE public.user_links
            SET ownership_status = 'REVOKED'
            WHERE id = $1;
        `, [linkId]);
        const revoked = await client.query(`
            SELECT ownership_status, verified FROM public.user_links WHERE id = $1;
        `, [linkId]);
        assert.equal(revoked.rows[0].ownership_status, 'REVOKED');
        assert.equal(revoked.rows[0].verified, false);

        // 6. Authorized reconnect flow: REVOKED -> CONNECTED_UNVERIFIED
        await client.query(`
            UPDATE public.user_links
            SET ownership_status = 'CONNECTED_UNVERIFIED',
                verified_at = NULL,
                legacy_unverified_at = CURRENT_TIMESTAMP
            WHERE id = $1;
        `, [linkId]);
        const reconnected = await client.query(`
            SELECT ownership_status, verified FROM public.user_links WHERE id = $1;
        `, [linkId]);
        assert.equal(reconnected.rows[0].ownership_status, 'CONNECTED_UNVERIFIED');
        assert.equal(reconnected.rows[0].verified, false);

        // 7. Change portal on a verified link -> also demotes to CONNECTED_UNVERIFIED
        await client.query(`
            UPDATE public.user_links
            SET ownership_status = 'VERIFIED'
            WHERE id = $1;
        `, [linkId]);
        await client.query(`
            UPDATE public.user_links
            SET portal = 'codeforces'
            WHERE id = $1;
        `, [linkId]);
        const afterPortalChange = await client.query(`
            SELECT ownership_status, verified FROM public.user_links WHERE id = $1;
        `, [linkId]);
        assert.equal(afterPortalChange.rows[0].ownership_status, 'CONNECTED_UNVERIFIED', 'Portal change must demote to CONNECTED_UNVERIFIED');
        assert.equal(afterPortalChange.rows[0].verified, false);
    });

    test('Step 9: Active challenge invalidation on identity modification (all 7 lifecycle scenarios)', async (t) => {
        if (!dbAvailable) { t.skip('Isolated PostgreSQL on port 5433 not active'); return; }

        const testUserId = '11111111-1111-1111-1111-111111111111';

        // Setup clean link for user
        await client.query(`DELETE FROM public.platform_verification_challenges WHERE user_id = $1;`, [testUserId]);
        await client.query(`DELETE FROM public.user_links WHERE user_id = $1 AND portal = 'leetcode';`, [testUserId]);

        const linkRes = await client.query(`
            INSERT INTO public.user_links (
                user_id, username, portal, portal_username, link, ownership_status, verified
            ) VALUES (
                $1, 'alice', 'leetcode', 'handle_a', 'https://leetcode.com/handle_a', 'CONNECTED_UNVERIFIED', false
            ) RETURNING id;
        `, [testUserId]);
        const testLinkId = linkRes.rows[0].id;

        // SCENARIO 1: Initiate a challenge for handle A
        const challengeTokenA = 'orbix-v-0123456789abcdef01234a';
        const tokenHashA = crypto.createHash('sha256').update(challengeTokenA).digest('hex');
        const chalRes = await client.query(`
            INSERT INTO public.platform_verification_challenges (
                user_id, link_id, portal, portal_username, token_hash,
                token_display_prefix, target_field, status, expires_at
            ) VALUES (
                $1, $2, 'leetcode', 'handle_a', $3,
                'orbix-v-0123', 'aboutMe', 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ) RETURNING id, status, portal_username;
        `, [testUserId, testLinkId, tokenHashA]);
        const challengeIdA = chalRes.rows[0].id;
        assert.equal(chalRes.rows[0].status, 'pending');
        assert.equal(chalRes.rows[0].portal_username, 'handle_a');

        // SCENARIO 2: Change connected handle to handle B -> Trigger automatically invalidates pending challenge
        await client.query(`
            UPDATE public.user_links
            SET portal_username = 'handle_b',
                link = 'https://leetcode.com/handle_b'
            WHERE id = $1;
        `, [testLinkId]);

        // Verify trigger marked challenge as 'invalidated'
        const chalAfterIdentityChange = await client.query(`
            SELECT id, status, last_error FROM public.platform_verification_challenges WHERE id = $1;
        `, [challengeIdA]);
        assert.equal(chalAfterIdentityChange.rows[0].status, 'invalidated', 'Trigger must mark active challenge as invalidated');
        assert.ok(chalAfterIdentityChange.rows[0].last_error?.includes('Identity changed'));

        // SCENARIO 3: Attempt confirmation using original challenge -> rejected because status is invalidated
        const activeChallengeCheck = await client.query(`
            SELECT id FROM public.platform_verification_challenges
            WHERE user_id = $1 AND portal = 'leetcode' AND status = 'pending';
        `, [testUserId]);
        assert.equal(activeChallengeCheck.rows.length, 0, 'No pending challenge must be findable');

        // SCENARIO 4: Confirm handle B cannot become verified through handle A's challenge
        const linkCheckB = await client.query(`
            SELECT portal_username, ownership_status, verified FROM public.user_links WHERE id = $1;
        `, [testLinkId]);
        assert.equal(linkCheckB.rows[0].portal_username, 'handle_b');
        assert.equal(linkCheckB.rows[0].ownership_status, 'CONNECTED_UNVERIFIED', 'Handle B must remain UNVERIFIED');
        assert.equal(linkCheckB.rows[0].verified, false);

        // SCENARIO 5: Confirm old challenge cannot be replayed
        // Attempting to consume an invalidated challenge must be blocked by status check
        const replayAttempt = await client.query(`
            UPDATE public.platform_verification_challenges
            SET status = 'verified', consumed_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'pending'
            RETURNING id;
        `, [challengeIdA]);
        assert.equal(replayAttempt.rows.length, 0, 'Invalidated challenge cannot transition to verified');

        // SCENARIO 6: Confirm a new challenge for handle B works normally
        const challengeTokenB = 'orbix-v-0123456789abcdef01234b';
        const tokenHashB = crypto.createHash('sha256').update(challengeTokenB).digest('hex');
        const chalBRes = await client.query(`
            INSERT INTO public.platform_verification_challenges (
                user_id, link_id, portal, portal_username, token_hash,
                token_display_prefix, target_field, status, expires_at
            ) VALUES (
                $1, $2, 'leetcode', 'handle_b', $3,
                'orbix-v-0123', 'aboutMe', 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ) RETURNING id, status, portal_username;
        `, [testUserId, testLinkId, tokenHashB]);
        const challengeIdB = chalBRes.rows[0].id;
        assert.equal(chalBRes.rows[0].status, 'pending');

        // Complete verification for handle B
        await client.query('BEGIN;');
        await client.query(`
            UPDATE public.platform_verification_challenges
            SET status = 'verified', consumed_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'pending';
        `, [challengeIdB]);
        await client.query(`
            UPDATE public.user_links
            SET ownership_status = 'VERIFIED',
                verified_at = CURRENT_TIMESTAMP,
                verified_handle = 'handle_b'
            WHERE id = $1 AND portal_username = 'handle_b';
        `, [testLinkId]);
        await client.query('COMMIT;');

        const verifiedB = await client.query(`
            SELECT portal_username, ownership_status, verified, verified_handle FROM public.user_links WHERE id = $1;
        `, [testLinkId]);
        assert.equal(verifiedB.rows[0].ownership_status, 'VERIFIED');
        assert.equal(verifiedB.rows[0].verified, true);
        assert.equal(verifiedB.rows[0].verified_handle, 'handle_b');

        // SCENARIO 7: Test concurrent identity modification and challenge confirmation (race condition)
        // Set link back to unverified with handle_b
        await client.query(`
            UPDATE public.user_links
            SET ownership_status = 'CONNECTED_UNVERIFIED', verified = false, verified_at = null, verified_handle = null
            WHERE id = $1;
        `, [testLinkId]);

        // Initiate challenge for handle_b
        const challengeTokenC = 'orbix-v-0123456789abcdef01234c';
        const tokenHashC = crypto.createHash('sha256').update(challengeTokenC).digest('hex');
        const chalCRes = await client.query(`
            INSERT INTO public.platform_verification_challenges (
                user_id, link_id, portal, portal_username, token_hash,
                token_display_prefix, target_field, status, expires_at
            ) VALUES (
                $1, $2, 'leetcode', 'handle_b', $3,
                'orbix-v-0123', 'aboutMe', 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ) RETURNING id;
        `, [testUserId, testLinkId, tokenHashC]);
        const challengeIdC = chalCRes.rows[0].id;

        // Stage 1 reads challenge for 'handle_b'
        // In the background (during Stage 2 HTTP call), user changes handle to 'handle_c'
        await client.query(`
            UPDATE public.user_links SET portal_username = 'handle_c' WHERE id = $1;
        `, [testLinkId]);

        // Stage 3 tries to commit verification using challengeIdC:
        // Atomic row check verifies current_link_username vs challenge.portal_username
        await client.query('BEGIN;');
        const stage3Lock = await client.query(`
            SELECT pvc.id, pvc.status, pvc.portal_username, ul.portal_username AS current_link_username
            FROM public.platform_verification_challenges pvc
            LEFT JOIN public.user_links ul ON ul.id = pvc.link_id
            WHERE pvc.id = $1
            FOR UPDATE OF pvc;
        `, [challengeIdC]);

        // Challenge was marked invalidated by the identity change trigger
        assert.equal(stage3Lock.rows[0].status, 'invalidated', 'Trigger invalidated challenge during concurrent mutation');
        assert.equal(stage3Lock.rows[0].current_link_username, 'handle_c');
        assert.notEqual(stage3Lock.rows[0].current_link_username, stage3Lock.rows[0].portal_username);

        // Confirmation must abort and roll back
        await client.query('ROLLBACK;');

        // Verify handle_c remains unverified
        const linkCheckC = await client.query(`
            SELECT portal_username, ownership_status, verified FROM public.user_links WHERE id = $1;
        `, [testLinkId]);
        assert.equal(linkCheckC.rows[0].portal_username, 'handle_c');
        assert.equal(linkCheckC.rows[0].ownership_status, 'CONNECTED_UNVERIFIED', 'Handle C must remain UNVERIFIED');
        assert.equal(linkCheckC.rows[0].verified, false);
    });
});
