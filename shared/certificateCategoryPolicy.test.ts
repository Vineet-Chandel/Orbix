import test from "node:test";
import assert from "node:assert/strict";
import { CERTIFICATE_CATEGORY_POLICY, normalizeCertificateCategoryFields } from "./certificateCategoryPolicy.js";

test("all 16 categories derive only the relevant award and role fields", () => {
    assert.equal(Object.keys(CERTIFICATE_CATEGORY_POLICY).length, 16);
    for (const [certificateType, policy] of Object.entries(CERTIFICATE_CATEGORY_POLICY)) {
        const original = {
            certificateType, awardPosition: " Custom Achievement ",
            recipients: [{ userId: "student", customPosition: "Old rank", customRole: "Old role" }],
            teamSnapshots: [{ teamId: "team", members: [{ role: "Developer", customPosition: "Old rank" }] }],
        };
        const normalized = normalizeCertificateCategoryFields(original);
        const expectedPosition = policy.customAchievement ? "Custom Achievement" : policy.position;
        assert.equal(normalized.awardPosition, expectedPosition, certificateType);
        assert.equal(normalized.recipients[0]?.customPosition, expectedPosition, certificateType);
        assert.equal(normalized.recipients[0]?.customRole, policy.role, certificateType);
        assert.equal(normalized.teamSnapshots[0]?.members[0]?.customPosition, expectedPosition, certificateType);
        assert.equal(normalized.teamSnapshots[0]?.members[0]?.role, "Developer");
        assert.equal(original.recipients[0]?.customPosition, "Old rank", "normalization must not mutate saved recipients");
    }
});

test("changing from winner or speaker to participation clears stale award fields", () => {
    for (const previousCategory of ["winner", "speaker", "custom"]) {
        const previous = normalizeCertificateCategoryFields({ certificateType: previousCategory, awardPosition: "Custom", recipients: [{ customPosition: "1st", customRole: "Speaker" }] });
        const next = normalizeCertificateCategoryFields({ ...previous, certificateType: "participation" });
        assert.equal(next.awardPosition, undefined);
        assert.equal(next.recipients[0]?.customPosition, undefined);
        assert.equal(next.recipients[0]?.customRole, undefined);
    }
});

test("only registration, attendance and completion auto-select eligible recipients", () => {
    assert.deepEqual(Object.entries(CERTIFICATE_CATEGORY_POLICY).filter(([, policy]) => policy.autoSelect).map(([category]) => category), ["participation", "attendance", "completion"]);
    assert.deepEqual(Object.entries(CERTIFICATE_CATEGORY_POLICY).filter(([, policy]) => policy.customAchievement).map(([category]) => category), ["custom"]);
});
