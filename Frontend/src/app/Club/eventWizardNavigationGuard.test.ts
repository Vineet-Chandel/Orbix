import test from "node:test";
import assert from "node:assert/strict";
import {
    validateStep1,
    validateStep2,
    validateStep3,
    validateStep4,
    evaluateStepNavigation,
    getMaxPermittedStep,
    type WizardNavigationState,
    type FormValidationState,
} from "./eventWizardNavigationGuard.ts";

const createValidForm = (): FormValidationState => ({
    title: "Orbix Hackathon 2026",
    startsAt: "2026-12-01T10:00:00.000Z",
    endsAt: "2026-12-02T18:00:00.000Z",
    registrationUrl: "https://orbix.dev/register",
    locationType: "in_person",
    venueOrLocation: "Main Auditorium, Campus",
    status: "draft",
    isTeamEvent: false,
    minTeamSize: 1,
    maxTeamSize: 4,
    coverImageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
});

const createValidState = (): WizardNavigationState => ({
    form: createValidForm(),
    stages: [{ id: "stg_1", name: "Round 1" }],
    totalQuestions: 3,
    isUploadingBanner: false,
});

test("Step 1 → Step 3 blocked when Step 1 is incomplete (empty title)", () => {
    const state = createValidState();
    state.form.title = "";

    const result = evaluateStepNavigation(1, 3, state);
    assert.equal(result.allowed, false);
    assert.equal(result.blockingStep, 1);
    assert.equal(result.errorMessage, "Event title is required.");
    assert.ok(result.step1Errors?.title);
});

test("Step 1 → Step 5 blocked when Step 1 is incomplete (missing startsAt)", () => {
    const state = createValidState();
    state.form.startsAt = "";

    const result = evaluateStepNavigation(1, 5, state);
    assert.equal(result.allowed, false);
    assert.equal(result.blockingStep, 1);
    assert.equal(result.errorMessage, "Event start date and time is required.");
    assert.ok(result.step1Errors?.startsAt);
});

test("Step 2 → Step 4 blocked when Step 2 is incomplete (stages empty)", () => {
    const state = createValidState();
    state.stages = [];

    const result = evaluateStepNavigation(2, 4, state);
    assert.equal(result.allowed, false);
    assert.equal(result.blockingStep, 2);
    assert.equal(result.errorMessage, "Please configure at least 1 round/stage in your timeline.");
});

test("Step 3 → Step 5 blocked when Step 3 is incomplete (0 questions)", () => {
    const state = createValidState();
    state.totalQuestions = 0;

    const result = evaluateStepNavigation(3, 5, state);
    assert.equal(result.allowed, false);
    assert.equal(result.blockingStep, 3);
    assert.equal(result.errorMessage, "The registration form cannot be empty. Please include at least 1 question for participants.");
});

test("Step 4 → Step 5 blocked when Step 4 is incomplete (missing coverImageUrl)", () => {
    const state = createValidState();
    state.form.coverImageUrl = "";

    const result = evaluateStepNavigation(4, 5, state);
    assert.equal(result.allowed, false);
    assert.equal(result.blockingStep, 4);
    assert.equal(result.errorMessage, "Please select or upload a banner for your event.");
});

test("Step 4 → Step 5 blocked when banner upload is in progress", () => {
    const state = createValidState();
    state.isUploadingBanner = true;

    const result = evaluateStepNavigation(4, 5, state);
    assert.equal(result.allowed, false);
    assert.equal(result.blockingStep, 4);
    assert.equal(result.errorMessage, "Please wait for your banner upload to complete.");
});

test("Sequential forward navigation allowed when preceding steps are valid", () => {
    const state = createValidState();

    // 1 -> 2
    const nav1to2 = evaluateStepNavigation(1, 2, state);
    assert.equal(nav1to2.allowed, true);
    assert.equal(nav1to2.targetStep, 2);

    // 2 -> 3
    const nav2to3 = evaluateStepNavigation(2, 3, state);
    assert.equal(nav2to3.allowed, true);
    assert.equal(nav2to3.targetStep, 3);

    // 3 -> 4
    const nav3to4 = evaluateStepNavigation(3, 4, state);
    assert.equal(nav3to4.allowed, true);
    assert.equal(nav3to4.targetStep, 4);

    // 4 -> 5
    const nav4to5 = evaluateStepNavigation(4, 5, state);
    assert.equal(nav4to5.allowed, true);
    assert.equal(nav4to5.targetStep, 5);
});

test("Backward navigation is always permitted without forward validation", () => {
    const state = createValidState();
    // Invalidate earlier steps; backward navigation must still succeed
    state.stages = [];
    state.totalQuestions = 0;

    assert.equal(evaluateStepNavigation(5, 4, state).allowed, true);
    assert.equal(evaluateStepNavigation(5, 3, state).allowed, true);
    assert.equal(evaluateStepNavigation(4, 3, state).allowed, true);
    assert.equal(evaluateStepNavigation(3, 2, state).allowed, true);
    assert.equal(evaluateStepNavigation(2, 1, state).allowed, true);
    assert.equal(evaluateStepNavigation(5, 1, state).allowed, true);
});

test("Existing entered data preserved after blocked navigation attempts", () => {
    const state = createValidState();
    state.form.title = ""; // Incomplete Step 1
    const originalSummary = "Detailed event description";
    state.form.venueOrLocation = originalSummary;
    state.stages = [{ id: "stg_custom", name: "Semi Finals" }];

    // Attempt blocked navigation
    const result = evaluateStepNavigation(1, 4, state);
    assert.equal(result.allowed, false);

    // Verify all entered data is untouched and preserved
    assert.equal(state.form.venueOrLocation, originalSummary);
    assert.equal(state.stages.length, 1);
    assert.equal((state.stages[0] as { name: string }).name, "Semi Finals");
    assert.equal(state.totalQuestions, 3);
});

test("Direct unit tests for step validators (validateStep2, validateStep3, validateStep4)", () => {
    // Step 2
    assert.equal(validateStep2([]).isValid, false);
    assert.equal(validateStep2([{ id: "s1" }]).isValid, true);

    // Step 3
    assert.equal(validateStep3(0).isValid, false);
    assert.equal(validateStep3(2).isValid, true);

    // Step 4
    assert.equal(validateStep4("").isValid, false);
    assert.equal(validateStep4("https://orbix.dev/banner.png", true).isValid, false);
    assert.equal(validateStep4("https://orbix.dev/banner.png", false).isValid, true);
});

test("Editing an earlier step invalidates forward navigation when required data becomes incomplete", () => {
    const state = createValidState();

    // User was previously on Step 4 (all valid)
    assert.equal(evaluateStepNavigation(3, 4, state).allowed, true);

    // User goes back to Step 1 and clears the title
    state.form.title = "   ";

    // Now trying to jump from Step 1 to Step 4 must be blocked
    const navAttempt = evaluateStepNavigation(1, 4, state);
    assert.equal(navAttempt.allowed, false);
    assert.equal(navAttempt.blockingStep, 1);
    assert.equal(navAttempt.errorMessage, "Event title is required.");
});

test("Validation rejects invalid endsAt preceding startsAt", () => {
    const form = createValidForm();
    form.startsAt = "2026-12-05T12:00:00.000Z";
    form.endsAt = "2026-12-05T10:00:00.000Z"; // Before start

    const result = validateStep1(form);
    assert.equal(result.isValid, false);
    assert.equal(result.errorMessage, "End date and time must be strictly after the start date and time.");
});

test("Validation rejects malformed registrationUrl", () => {
    const form = createValidForm();
    form.registrationUrl = "not-a-valid-url";

    const result = validateStep1(form);
    assert.equal(result.isValid, false);
    assert.ok(result.errorMessage?.includes("Must be a valid URL"));
});

test("Validation rejects invalid team sizes when isTeamEvent is true", () => {
    const form = createValidForm();
    form.isTeamEvent = true;
    form.minTeamSize = 5;
    form.maxTeamSize = 2; // max < min

    const result = validateStep1(form);
    assert.equal(result.isValid, false);
    assert.equal(result.errorMessage, "Maximum team size cannot be smaller than minimum (5).");
});

test("getMaxPermittedStep correctly identifies the furthest unlocked step", () => {
    const state = createValidState();
    assert.equal(getMaxPermittedStep(state), 5);

    state.form.coverImageUrl = "";
    assert.equal(getMaxPermittedStep(state), 4);

    state.totalQuestions = 0;
    assert.equal(getMaxPermittedStep(state), 3);

    state.stages = [];
    assert.equal(getMaxPermittedStep(state), 2);

    state.form.title = "";
    assert.equal(getMaxPermittedStep(state), 1);
});
