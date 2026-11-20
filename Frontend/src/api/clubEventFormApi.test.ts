import { test } from "node:test";
import assert from "node:assert/strict";
import { getCanonicalFormString, isFormContentEqual, fetchClubEventForm } from "./clubEventFormApi.ts";

const fixture = () => ({
    title: "Registration", description: null, headerImageUrl: null,
    settings: { quiz: { isQuiz: false } }, themeSettings: { accentColor: "#38BDF8" },
    structure: { sections: [{ id: "s1", title: "Questions", questions: [{
        id: "q1", type: "multiple_choice", title: "Choose", required: false,
        options: [{ id: "o1", text: "First" }],
    }] }] },
});

for (const [name, change] of Object.entries({
    "option text": (f: any) => { f.structure.sections[0].questions[0].options[0].text = "Changed"; },
    "option image": (f: any) => { f.structure.sections[0].questions[0].options[0].imageUrl = "https://example.com/option.png"; },
    "question image": (f: any) => { f.structure.sections[0].questions[0].imageUrl = "https://example.com/question.png"; },
    "required toggle": (f: any) => { f.structure.sections[0].questions[0].required = true; },
    "validation": (f: any) => { f.structure.sections[0].questions[0].validation = { minSelected: 2 }; },
    "branching": (f: any) => { f.structure.sections[0].questions[0].options[0].goToSectionId = "submit_form"; },
    "section routing": (f: any) => { f.structure.sections[0].goToSectionId = "submit_form"; },
    "theme": (f: any) => { f.themeSettings.backgroundColor = "#000000"; },
    "quiz answers": (f: any) => { f.structure.sections[0].questions[0].correctAnswers = ["o1"]; },
    "settings": (f: any) => { f.settings.shuffleQuestions = true; },
})) {
    test(`publication comparison detects ${name} edits`, () => {
        const before = fixture(); const after = structuredClone(before); change(after);
        assert.equal(isFormContentEqual(before, after), false);
    });
}

test("publication comparison ignores record metadata, key order and UI state", () => {
    const before = fixture();
    const after = { updatedAt: "later", isPublished: true, ...structuredClone(before) };
    Object.assign(after.structure.sections[0].questions[0], { isEditing: true, tempId: "temporary" });
    assert.equal(isFormContentEqual(before, after), true);
    assert.equal(getCanonicalFormString({ ...before, settings: { b: 2, a: 1 } }), getCanonicalFormString({ ...before, settings: { a: 1, b: 2 } }));
});

test("publication comparison accepts JSON snapshots", () => {
    const before = fixture();
    assert.equal(isFormContentEqual(before, { ...before, structure: JSON.stringify(before.structure), settings: JSON.stringify(before.settings), themeSettings: JSON.stringify(before.themeSettings) }), true);
});

test("form load forwards cancellation and encodes the event ID", async () => {
    const original = globalThis.fetch;
    const controller = new AbortController();
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "/api/club/events/event%2F1/form");
        assert.ok(options?.signal);
        controller.abort();
        assert.equal(options.signal.aborted, true);
        return new Response(JSON.stringify({ success: true, form: fixture() }));
    };
    try { await fetchClubEventForm("event/1", controller.signal); }
    finally { globalThis.fetch = original; }
});
