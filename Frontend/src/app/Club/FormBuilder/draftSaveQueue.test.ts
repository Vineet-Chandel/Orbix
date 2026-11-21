import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftSaveQueue } from "./draftSaveQueue.ts";

test("autosave finishes before explicit save; identical pending snapshots write once", async () => {
    const queue = createDraftSaveQueue();
    const calls: string[] = [];
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const first = queue.enqueue("old", async () => { calls.push("old:start"); await pending; calls.push("old:end"); });
    const second = queue.enqueue("new", async () => { calls.push("new"); });
    const duplicate = queue.enqueue("new", async () => { calls.push("duplicate"); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(calls, ["old:start"]);
    release();
    await Promise.all([first, second, duplicate]);
    assert.deepEqual(calls, ["old:start", "old:end", "new"]);
});

test("failed writes can be retried without blocking later edits", async () => {
    const queue = createDraftSaveQueue();
    await assert.rejects(queue.enqueue("a", async () => { throw new Error("offline"); }));
    let writes = 0;
    await queue.enqueue("a", async () => { writes++; });
    await queue.enqueue("b", async () => { writes++; });
    assert.equal(writes, 2);
});

test("loaded and saved drafts do not trigger redundant network writes", async () => {
    const queue = createDraftSaveQueue();
    queue.markSaved("loaded");
    let writes = 0;
    await queue.enqueue("loaded", async () => { writes++; });
    assert.equal(writes, 0);
});
