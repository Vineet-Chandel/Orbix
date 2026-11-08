import { describe, it } from "node:test";
import assert from "node:assert";
import { ClubCredibilityService } from "../../services/club/clubCredibilityService.js";

describe("Club Event Creation Eligibility & Cooldown Engine", () => {
    it("1. Verifies exact score thresholds: Campus min 20, Pan India min 50", () => {
        assert.strictEqual(ClubCredibilityService.MIN_CAMPUS_SCORE, 20.0);
        assert.strictEqual(ClubCredibilityService.MIN_PAN_INDIA_SCORE, 50.0);
    });

    it("2. Verifies cooldown durations: Campus 12 hours, Pan India 72 hours (3 days)", () => {
        const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        assert.strictEqual(ClubCredibilityService.CAMPUS_COOLDOWN_MS, TWELVE_HOURS_MS);
        assert.strictEqual(ClubCredibilityService.PAN_INDIA_COOLDOWN_MS, THREE_DAYS_MS);
    });

    it("3. formatDuration formats days, hours, and minutes correctly", () => {
        assert.strictEqual(ClubCredibilityService.formatDuration(0), "0m");
        assert.strictEqual(ClubCredibilityService.formatDuration(1000 * 60 * 45), "45m");
        assert.strictEqual(ClubCredibilityService.formatDuration(1000 * 60 * 60 * 8 + 1000 * 60 * 20), "8h 20m");
        assert.strictEqual(ClubCredibilityService.formatDuration(1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 60 * 5), "2d 5h");
        assert.strictEqual(ClubCredibilityService.formatDuration(1000 * 60 * 60 * 72), "3d 0h");
    });

    it("4. Evaluates simulated eligibility scenarios correctly", () => {
        // Scenario A: Newly enrolled club with default 50.0 score, no events created yet
        const defaultScore = 50.0;
        assert.ok(defaultScore >= ClubCredibilityService.MIN_CAMPUS_SCORE, "Campus score passed for new club");
        assert.ok(defaultScore >= ClubCredibilityService.MIN_PAN_INDIA_SCORE, "Pan India score passed for new club");

        // Scenario B: Club with score 42.0 (fell below 50 due to cancellation/penalty)
        const reducedScore = 42.0;
        assert.ok(reducedScore >= ClubCredibilityService.MIN_CAMPUS_SCORE, "Campus allowed for score 42");
        assert.ok(reducedScore < ClubCredibilityService.MIN_PAN_INDIA_SCORE, "Pan India locked for score 42");

        // Scenario C: Critical trust club with score 18.0
        const criticalScore = 18.0;
        assert.ok(criticalScore < ClubCredibilityService.MIN_CAMPUS_SCORE, "Campus locked for score 18");
        assert.ok(criticalScore < ClubCredibilityService.MIN_PAN_INDIA_SCORE, "Pan India locked for score 18");

        // Scenario D: Cooldown timing calculations
        const now = Date.now();
        const campusEventCreated2HoursAgo = new Date(now - (2 * 60 * 60 * 1000)).toISOString();
        const campusRemainingMs = (new Date(campusEventCreated2HoursAgo).getTime() + ClubCredibilityService.CAMPUS_COOLDOWN_MS) - now;
        assert.ok(campusRemainingMs > 0, "Campus is currently in 12h cooldown");
        assert.strictEqual(Math.round(campusRemainingMs / (1000 * 60 * 60)), 10, "10 hours remaining in cooldown");

        const campusEventCreated15HoursAgo = new Date(now - (15 * 60 * 60 * 1000)).toISOString();
        const campusExpiredMs = (new Date(campusEventCreated15HoursAgo).getTime() + ClubCredibilityService.CAMPUS_COOLDOWN_MS) - now;
        assert.ok(campusExpiredMs <= 0, "Campus 12h cooldown has expired");

        const panIndiaEventCreated1DayAgo = new Date(now - (24 * 60 * 60 * 1000)).toISOString();
        const panIndiaRemainingMs = (new Date(panIndiaEventCreated1DayAgo).getTime() + ClubCredibilityService.PAN_INDIA_COOLDOWN_MS) - now;
        assert.ok(panIndiaRemainingMs > 0, "Pan India is currently in 3-day cooldown");
        assert.strictEqual(Math.round(panIndiaRemainingMs / (1000 * 60 * 60 * 24)), 2, "2 days remaining in cooldown");
    });
});
