import { test } from "node:test";
import assert from "node:assert/strict";
import { store, setUser, clearUser } from "./index.ts";
import { personalDataApi } from "./personalDataApi.ts";
import eventsReducer, { fetchEvents } from "./eventsSlice.ts";

const user = { id: "user-a", username: "alice", gmail: "alice@example.com", firstName: "Alice", lastName: "A" };
const scope = { userId: user.id, collegeId: "college-a" };
const response = { success: true, collegeName: "Campus A", collegeId: "college-a", events: [] };

test("section cache deduplicates requests, survives navigation, and clears on identity change", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json(response); };
    try {
        store.dispatch(setUser({ ...user }));
        const first = store.dispatch(personalDataApi.endpoints.campusEvents.initiate(scope));
        const second = store.dispatch(personalDataApi.endpoints.campusEvents.initiate(scope));
        await Promise.all([first, second]);
        assert.equal(calls, 1);
        first.unsubscribe(); second.unsubscribe();
        const returning = store.dispatch(personalDataApi.endpoints.campusEvents.initiate(scope));
        assert.deepEqual((await returning).data, response);
        assert.equal(calls, 1);
        returning.unsubscribe();
        store.dispatch(setUser({ ...user, id: "user-b", username: "bob" }));
        assert.equal(personalDataApi.endpoints.campusEvents.select(scope)(store.getState()).data, undefined);
    } finally {
        store.dispatch(clearUser());
        store.dispatch(personalDataApi.util.resetApiState());
        globalThis.fetch = original;
    }
});

test("a response arriving after logout cannot repopulate private section data", async () => {
    const original = globalThis.fetch;
    let resolve!: (r: Response) => void;
    globalThis.fetch = () => new Promise<Response>((finish) => { resolve = finish; });
    try {
        store.dispatch(setUser({ ...user }));
        const pending = store.dispatch(personalDataApi.endpoints.campusEvents.initiate(scope));
        store.dispatch(clearUser());
        resolve(Response.json(response));
        await pending;
        assert.equal(personalDataApi.endpoints.campusEvents.select(scope)(store.getState()).data, undefined);
        pending.unsubscribe();
    } finally {
        store.dispatch(personalDataApi.util.resetApiState());
        globalThis.fetch = original;
    }
});

test("Event Tracker reuses a fresh empty calendar and respects explicit refresh", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ success: true, events: [] }); };
    const { configureStore } = await import("@reduxjs/toolkit");
    const calendar = configureStore({ reducer: { events: eventsReducer } });
    try {
        await calendar.dispatch(fetchEvents({}));
        await calendar.dispatch(fetchEvents({}));
        assert.equal(calls, 1);
        await calendar.dispatch(fetchEvents({ refresh: true }));
        assert.equal(calls, 2);
    } finally { globalThis.fetch = original; }
});

test("Event Tracker deduplicates background refresh while keeping existing events visible", async () => {
    const original = globalThis.fetch;
    const { configureStore } = await import("@reduxjs/toolkit");
    const calendar = configureStore({ reducer: { events: eventsReducer } });
    let finish!: (response: Response) => void;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ events: [{ id: "calendar-event" }] }); };
    try {
        await calendar.dispatch(fetchEvents({}));
        globalThis.fetch = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
        const refresh = calendar.dispatch(fetchEvents({ refresh: true }));
        await calendar.dispatch(fetchEvents({ refresh: true }));
        assert.equal(calls, 2);
        assert.equal(calendar.getState().events.loading, false);
        assert.equal(calendar.getState().events.fetching, true);
        assert.equal(calendar.getState().events.allEvents[0]?.id, "calendar-event");
        finish(Response.json({ events: [] }));
        await refresh;
        assert.equal(calendar.getState().events.fetching, false);
    } finally { globalThis.fetch = original; }
});
