import assert from "node:assert/strict";
import { after, test } from "node:test";
import redis from "../client.js";
import { getUserDetailsCache, userDetailsCache } from "./cache-auth.js";

after(() => redis.disconnect());

test("auth cache never returns a legacy password hash or stores a new one", async (t) => {
    const status = redis.status;
    redis.status = "ready";
    t.after(() => { redis.status = status; });

    t.mock.method(redis, "hgetall", async () => ({
        id: "user-id",
        gmail: "coder@example.test",
        firstName: "Coder",
        username: "coder",
        password_hash: "unused-legacy-password-hash",
    }));
    const write = t.mock.method(redis, "hset", async () => 1);
    const remove = t.mock.method(redis, "hdel", async () => 1);
    t.mock.method(redis, "expire", async () => 1);
    t.mock.method(redis, "set", async () => "OK");

    const user = await getUserDetailsCache("coder@example.test");
    assert.ok(user);
    assert.equal(user.username, "coder");
    assert.equal(Object.hasOwn(user, "password_hash"), false);

    await userDetailsCache(user);
    assert.equal(write.mock.callCount(), 1);
    const [, stored] = write.mock.calls[0]?.arguments ?? [];
    assert.ok(stored && typeof stored === "object");
    assert.equal(Object.hasOwn(stored, "password_hash"), false);
    assert.deepEqual(remove.mock.calls[0]?.arguments, ["auth:user:gmail:coder@example.test", "password_hash"]);
});
