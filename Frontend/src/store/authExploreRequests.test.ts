import { test } from "node:test";
import assert from "node:assert/strict";
import userReducer, { setUser, clearUser, fetchUserProfile } from "./userSlice.ts";
import networkReducer, { fetchExploreDevelopersThunk } from "./networkSlice.ts";

const user = { id: "new-user", firstName: "New", lastName: "User", username: "new", gmail: "new@example.com" };

test("a late profile response cannot restore a signed-out user", () => {
    let state = userReducer(undefined, fetchUserProfile.pending("old", undefined));
    state = userReducer(state, clearUser());
    state = userReducer(state, fetchUserProfile.fulfilled(user, "old", undefined));
    assert.equal(state.user, null);
    assert.equal(state.loading, false);
});

test("an older session's 401 cannot log out a fresh login", () => {
    let state = userReducer(undefined, fetchUserProfile.pending("old", undefined));
    state = userReducer(state, setUser(user));
    state = userReducer(state, fetchUserProfile.rejected(null, "old", undefined, "Unauthorized"));
    assert.equal(state.user?.id, "new-user");
    assert.equal(state.isAuthenticated, true);
});

const params = { isInitial: true, search: "new" };
const page = { users: [], total: 0, page: 1, totalPages: 1, isInitial: true, availableColleges: [] };

test("an old Explore response cannot replace results for newer filters", () => {
    let state = networkReducer(undefined, fetchExploreDevelopersThunk.pending("old", { isInitial: true }));
    state = networkReducer(state, fetchExploreDevelopersThunk.pending("new", params));
    state = networkReducer(state, fetchExploreDevelopersThunk.fulfilled({ ...page, total: 123 }, "old", {}));
    assert.equal(state.explore.total, 0);
    assert.equal(state.explore.isLoading, true);
    state = networkReducer(state, fetchExploreDevelopersThunk.fulfilled(page, "new", params));
    assert.equal(state.explore.isLoading, false);
});

test("signout clears discovery data and ignores its pending request", () => {
    let state = networkReducer(undefined, fetchExploreDevelopersThunk.pending("old", params));
    state = networkReducer(state, clearUser());
    state = networkReducer(state, fetchExploreDevelopersThunk.fulfilled({ ...page, total: 99 }, "old", params));
    assert.equal(state.explore.total, 0);
    assert.deepEqual(state.explore.items, []);
});

test("offline network failure prevents unverified session access", () => {
    let state = userReducer(undefined, { type: "@@INIT" });
    assert.equal(state.user, null);
    assert.equal(state.isAuthenticated, false);

    state = userReducer(state, fetchUserProfile.pending("req1", undefined));
    state = userReducer(state, fetchUserProfile.rejected(null, "req1", undefined, "Offline: Internet connection is unavailable."));
    assert.equal(state.user, null);
    assert.equal(state.isAuthenticated, false);
    assert.equal(state.loading, false);
});

test("server confirmation is required to enter workspace authenticated state", () => {
    let state = userReducer(undefined, fetchUserProfile.pending("req2", undefined));
    assert.equal(state.isAuthenticated, false);

    state = userReducer(state, fetchUserProfile.fulfilled(user, "req2", undefined));
    assert.equal(state.isAuthenticated, true);
    assert.equal(state.user?.id, "new-user");
    assert.equal(state.loading, false);
});
