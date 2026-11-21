import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFormContentHash, canonicalizeFormContent } from "./formSecuritySanitizer.js";
import { canonicalizeFormContent as frontendContent } from "../../../Frontend/src/api/clubEventFormApi.js";

const form = {
    title: "Registration", settings: {}, themeSettings: {},
    structure: { sections: [{ id: "s1", questions: [{ id: "q1", type: "multiple_choice", required: false, options: [{ id: "o1", text: "First" }] }] }] },
};

test("server draft deduplication detects actual option, image and required changes", () => {
    const original = computeFormContentHash(form);
    for (const patch of [{ required: true }, { imageUrl: "image.png" }, { options: [{ id: "o1", text: "Changed" }] }, { validation: { minSelected: 2 } }, { correctAnswers: ["o1"] }]) {
        const changed = structuredClone(form);
        Object.assign(changed.structure.sections[0]!.questions[0]!, patch);
        assert.notEqual(computeFormContentHash(changed), original);
    }
});

test("server and builder compare the same form content", () => {
    assert.deepEqual(canonicalizeFormContent(form), frontendContent(form));
    assert.equal(computeFormContentHash(form), computeFormContentHash({ ...form, updatedAt: "later", isPublished: true }));
});
