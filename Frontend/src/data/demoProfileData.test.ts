import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isDemoProfileUsername } from "./demoProfileData.js";

describe("isDemoProfileUsername - Demo Profile and Vineet Handle Resolution", () => {
    test("flags vineet-chandel and demo handles as demo profile", () => {
        assert.equal(isDemoProfileUsername("vineet-chandel"), true);
        assert.equal(isDemoProfileUsername("Vineet-Chandel"), true);
        assert.equal(isDemoProfileUsername("demo"), true);
        assert.equal(isDemoProfileUsername("demo-profile"), true);
    });

    test("does NOT flag vineet_chandel or vineet_chnadel as demo profile", () => {
        assert.equal(isDemoProfileUsername("vineet_chandel"), false);
        assert.equal(isDemoProfileUsername("Vineet_Chandel"), false);
        assert.equal(isDemoProfileUsername("vineet_chnadel"), false);
    });
});
