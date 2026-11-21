import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isDemoProfileHandle, checkStaticHandleAvailability } from "./usernamePolicy.js";

describe("usernamePolicy - Demo Profile and Vineet Handle Resolution", () => {
    test("flags vineet-chandel as reserved demo profile handle", () => {
        assert.equal(isDemoProfileHandle("vineet-chandel"), true);
        assert.equal(isDemoProfileHandle("Vineet-Chandel"), true);
        assert.equal(isDemoProfileHandle("demo-vineet-chandel"), true);
        assert.equal(isDemoProfileHandle("vineet-chandel-demo"), true);
        assert.equal(isDemoProfileHandle("demo"), true);
        assert.equal(isDemoProfileHandle("demo-profile"), true);
    });

    test("does NOT flag vineet_chandel or vineet_chnadel as demo handle", () => {
        assert.equal(isDemoProfileHandle("vineet_chandel"), false);
        assert.equal(isDemoProfileHandle("Vineet_Chandel"), false);
        assert.equal(isDemoProfileHandle("vineet_chnadel"), false);
    });

    test("checkStaticHandleAvailability allows vineet_chandel but blocks vineet-chandel", () => {
        const checkRealUser = checkStaticHandleAvailability("vineet_chandel", "user");
        assert.equal(checkRealUser.available, true);
        assert.equal(checkRealUser.normalized, "vineet_chandel");

        const checkDemo = checkStaticHandleAvailability("vineet-chandel", "user");
        assert.equal(checkDemo.available, false);
        assert.equal(checkDemo.code, "DEMO_PROFILE_RESERVED");
    });
});
