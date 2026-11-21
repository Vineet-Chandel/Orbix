import { test, describe } from "node:test";
import assert from "node:assert/strict";
import ClubRegistrationValidator from "./ClubRegistrationValidator.js";

describe("ClubRegistrationValidator", () => {
    const validBasePayload = {
        clubName: "Google Developer Student Club",
        collegeId: "00000000-0000-0000-0000-000000000001",
        collegeName: "Chandigarh University",
        collegeCity: "Mohali",
        collegeState: "Punjab",
        collegeCountry: "India",
        clubCategory: "coding",
        clubDescription: "Official developer club on campus.",
        contactPersonName: "Vineet Chandel",
        contactPersonRole: "Lead Coordinator",
        contactEmail: "vineet.lead@gmail.com",
        username: "gdsc_cu",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        termsAccepted: true,
        privacyPolicyAccepted: true,
    };

    test("Successfully validates club registration WITHOUT phone number", () => {
        // Notice: NO contactPhone in payload
        const validated = ClubRegistrationValidator(validBasePayload);

        assert.equal(validated.clubName, "Google Developer Student Club");
        assert.equal(validated.collegeName, "Chandigarh University");
        assert.equal(validated.clubCategory, "coding");
        assert.equal(validated.contactPersonName, "Vineet Chandel");
        assert.equal(validated.contactEmail, "vineet.lead@gmail.com");
        assert.equal(validated.contactPhone, null);
        assert.equal(validated.contactPhoneFormatted, null);
        assert.equal(validated.username, "gdsc_cu");
        assert.equal(validated.termsAccepted, true);
        assert.equal(validated.privacyPolicyAccepted, true);
    });

    test("Successfully validates club registration WITH an optional phone number", () => {
        const payloadWithPhone = {
            ...validBasePayload,
            contactPhone: "9389205207",
        };

        const validated = ClubRegistrationValidator(payloadWithPhone);
        assert.equal(validated.contactPhone, "+919389205207");
        assert.equal(validated.contactPhoneFormatted, "+91 93892 05207");
    });

    test("Rejects registration when terms are not accepted", () => {
        const invalidPayload = {
            ...validBasePayload,
            termsAccepted: false,
        };

        assert.throws(
            () => ClubRegistrationValidator(invalidPayload),
            /You must accept the Terms of Service/
        );
    });

    test("Rejects registration when club name is missing or too short", () => {
        const invalidPayload = {
            ...validBasePayload,
            clubName: "A",
        };

        assert.throws(
            () => ClubRegistrationValidator(invalidPayload),
            /Club name is required/
        );
    });

    test("Rejects registration when contact email is invalid", () => {
        const invalidPayload = {
            ...validBasePayload,
            contactEmail: "not-an-email",
        };

        assert.throws(
            () => ClubRegistrationValidator(invalidPayload),
            /valid primary account email address is required/
        );
    });

    test("Rejects registration when passwords do not match", () => {
        const invalidPayload = {
            ...validBasePayload,
            password: "StrongPassword123!",
            confirmPassword: "DifferentPassword123!",
        };

        assert.throws(
            () => ClubRegistrationValidator(invalidPayload),
            /Passwords do not match/
        );
    });
});
