import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatYouTubeSubscriberCount } from "./EventScopeSelectionModal";

describe("formatYouTubeSubscriberCount", () => {
    it("handles zero, null, undefined, and negative numbers", () => {
        assert.equal(formatYouTubeSubscriberCount(0), "0");
        assert.equal(formatYouTubeSubscriberCount(null), "0");
        assert.equal(formatYouTubeSubscriberCount(undefined), "0");
        assert.equal(formatYouTubeSubscriberCount(-10), "0");
        assert.equal(formatYouTubeSubscriberCount(NaN), "0");
    });

    it("formats counts under 1,000 as raw numeric strings", () => {
        assert.equal(formatYouTubeSubscriberCount(1), "1");
        assert.equal(formatYouTubeSubscriberCount(3), "3");
        assert.equal(formatYouTubeSubscriberCount(394), "394");
        assert.equal(formatYouTubeSubscriberCount(999), "999");
    });

    it("formats counts between 1,000 and 999,999 with K suffix matching YouTube subscribers", () => {
        assert.equal(formatYouTubeSubscriberCount(1000), "1K");
        assert.equal(formatYouTubeSubscriberCount(1200), "1.2K");
        assert.equal(formatYouTubeSubscriberCount(1400), "1.4K");
        assert.equal(formatYouTubeSubscriberCount(1600), "1.6K");
        // YouTube truncates down to previous decimal milestone
        assert.equal(formatYouTubeSubscriberCount(1650), "1.6K");
        assert.equal(formatYouTubeSubscriberCount(1699), "1.6K");
        assert.equal(formatYouTubeSubscriberCount(10000), "10K");
        assert.equal(formatYouTubeSubscriberCount(14200), "14.2K");
        assert.equal(formatYouTubeSubscriberCount(100000), "100K");
        assert.equal(formatYouTubeSubscriberCount(999000), "999K");
    });

    it("formats counts of 1,000,000 and above with M suffix", () => {
        assert.equal(formatYouTubeSubscriberCount(1000000), "1M");
        assert.equal(formatYouTubeSubscriberCount(1200000), "1.2M");
        assert.equal(formatYouTubeSubscriberCount(1400000), "1.4M");
        assert.equal(formatYouTubeSubscriberCount(10000000), "10M");
        assert.equal(formatYouTubeSubscriberCount(25000000), "25M");
    });

    it("formats billions with B suffix", () => {
        assert.equal(formatYouTubeSubscriberCount(1000000000), "1B");
        assert.equal(formatYouTubeSubscriberCount(1500000000), "1.5B");
    });
});
