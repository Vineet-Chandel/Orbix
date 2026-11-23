import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { handleGetSavedPortals } from "../../Routes/portals/portals.js";
import { platformVerificationService } from "./platformVerificationService.js";
import { resetSchemaStateCache } from "./schemaCompatibility.js";

const originalQuery = pool.query;
const originalDel = redis.del;
const originalGet = redis.get;
const deleted: string[] = [];
let staleReads = 0;
beforeEach(() => {
    redis.disconnect();
    (redis as any).status = "ready";
    deleted.length = 0;
    staleReads = 0;
    resetSchemaStateCache();
    (redis as any).del = async (...keys: string[]) => { deleted.push(...keys); return keys.length; };
    (redis as any).get = async () => { staleReads++; return JSON.stringify([{ portal: "github", verified: false }]); };
    (pool as any).query = async (sql: string) => {
        if (sql.includes("information_schema.")) return { rows: [{ exists: 1 }] };
        if (sql.includes("FROM user_links")) {
            assert.match(sql, /ownership_status, verification_method, verified_at/);
            assert.match(sql, /user_id = \$2/);
            return { rows: [{ portal: "github", portal_username: "coder", ownership_status: "VERIFIED", verification_method: "oauth" }] };
        }
        if (sql.includes("SELECT username, email FROM public.users")) return { rows: [{ username: "coder", email: "coder@example.test" }] };
        return { rows: [] };
    };
});
after(async () => {
    (pool as any).query = originalQuery;
    (redis as any).del = originalDel;
    (redis as any).get = originalGet;
    redis.disconnect();
    await pool.end();
});

test("saved connections return committed ownership instead of a stale unverified cache", async () => {
    let response: any;
    const headers: Record<string, string> = {};
    const res: any = { setHeader: (key: string, value: string) => { headers[key] = value; }, status: () => res, json: (data: any) => { response = data; } };
    await handleGetSavedPortals({ user: { id: "user-id", username: "coder" } } as any, res);
    assert.equal(response.links[0].ownership_status, "VERIFIED");
    assert.equal(response.links[0].verification_method, "oauth");
    assert.equal(headers["Cache-Control"], "no-store");
    assert.equal(staleReads, 0);
});

test("verification invalidates private, public and saved connection caches before returning", async () => {
    await platformVerificationService.refreshOwnershipAfterCommit("user-id");
    for (const key of ["profile:private:user-id", "profile:public:privacy-v2:coder", "user:portals:coder", "user:portals:coder@example.test"]) {
        assert.ok(deleted.includes(key), `${key} must be invalidated`);
    }
});

test("OAuth ownership creates a saved connection even if Save Changes was never used", async () => {
    const writes: Array<{ sql: string; values: any[] }> = [];
    await platformVerificationService.recordVerifiedOwnership("user-id", "github", "coder", "oauth", { githubId: "123" }, {
        query: async (sql, values = []) => {
            writes.push({ sql, values });
            return { rows: sql.includes("SELECT username") ? [{ username: "orbix-user" }] : [] };
        },
    });
    const insert = writes.find((entry) => entry.sql.includes("INSERT INTO public.user_links"));
    assert.ok(insert);
    assert.match(insert.sql, /'VERIFIED'/);
    assert.deepEqual(insert.values.slice(0, 5), ["user-id", "orbix-user", "github", "coder", "https://github.com/coder"]);
});

test("an already verified handle reuses its proof without creating another challenge", async () => {
    (pool as any).query = async (sql: string) => {
        if (sql.includes("information_schema.")) return { rows: [{ exists: 1 }] };
        if (sql.includes("SELECT id, user_id, portal_username")) return { rows: [{ id: "link-id", user_id: "user-id", portal_username: "coder", verification_method: "profile_aboutMe", verified_at: "2026-11-21T00:00:00Z" }] };
        assert.doesNotMatch(sql, /INSERT INTO public.platform_verification_challenges/);
        return { rows: [] };
    };
    const result = await platformVerificationService.initiate("user-id", "leetcode", "coder");
    assert.equal(result.alreadyVerified, true);
    assert.equal(result.verificationMethod, "profile_aboutMe");
    assert.equal(result.verifiedAt, "2026-11-21T00:00:00Z");
    assert.ok(deleted.includes("profile:private:user-id"));
});
