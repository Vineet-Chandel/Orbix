import test from "node:test";
import assert from "node:assert/strict";
import SignupValidator, { ValidationError } from "./SignupValidator.js";

test("SignupValidator - handles valid signup data with optional collegeId", () => {
    const validPayload = {
        username: "johndoe",
        firstName: "John",
        lastName: "Doe",
        gmail: "john.doe@example.com",
        password: "K9#mQ7$vX2!pL5@z",
        termsAccepted: true,
        privacyPolicyAccepted: true,
        isAgeConfirmed: true,
        collegeId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    };

    const validated = SignupValidator(validPayload);
    assert.equal(validated.username, "johndoe");
    assert.equal(validated.firstName, "John");
    assert.equal(validated.middleName, null);
    assert.equal(validated.lastName, "Doe");
    assert.equal(validated.gmail, "john.doe@example.com");
    assert.equal(validated.collegeId, "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");
    assert.equal(validated.termsAccepted, true);
    assert.equal(validated.isAgeConfirmed, true);
});

test("SignupValidator - rejects missing or null collegeId as mandatory", () => {
    const invalidWithoutCollege = {
        username: "janedoe",
        firstName: "Jane",
        lastName: "Doe",
        gmail: "jane.doe@example.com",
        password: "B3%wT8^rY1*uM6!c",
        termsAccepted: true,
        privacyPolicyAccepted: true,
        isAgeConfirmed: true,
        collegeId: null,
    };

    assert.throws(
        () => SignupValidator(invalidWithoutCollege),
        (err: any) => err instanceof ValidationError && err.message.includes("College affiliation is required")
    );
});

test("SignupValidator - rejects invalid collegeId format", () => {
    const invalidCollege = {
        username: "janedoe",
        firstName: "Jane",
        lastName: "Doe",
        gmail: "jane.doe@example.com",
        password: "B3%wT8^rY1*uM6!c",
        termsAccepted: true,
        privacyPolicyAccepted: true,
        isAgeConfirmed: true,
        collegeId: "not-a-valid-uuid-12345",
    };

    assert.throws(
        () => SignupValidator(invalidCollege),
        (err: any) => err instanceof ValidationError && err.message.includes("Invalid college ID format")
    );
});

test("SignupValidator - rejects non-string collegeId types", () => {
    const invalidCollegeType = {
        username: "janedoe",
        firstName: "Jane",
        lastName: "Doe",
        gmail: "jane.doe@example.com",
        password: "B3%wT8^rY1*uM6!c",
        termsAccepted: true,
        privacyPolicyAccepted: true,
        isAgeConfirmed: true,
        collegeId: 12345,
    };

    assert.throws(
        () => SignupValidator(invalidCollegeType),
        (err: any) => err instanceof ValidationError && err.message.includes("College ID must be a string")
    );
});

test("SignupValidator - handles omitted middleName smoothly", () => {
    const payload = {
        username: "alexsmith",
        firstName: "Alex",
        lastName: "Smith",
        gmail: "alex.smith@example.com",
        password: "Z7@fV4#tG9$eH1^j",
        termsAccepted: true,
        privacyPolicyAccepted: true,
        isAgeConfirmed: true,
        collegeId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    };

    const validated = SignupValidator(payload);
    assert.equal(validated.middleName, null);
});
