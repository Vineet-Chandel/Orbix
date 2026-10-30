import validator from "validator";
import { ValidationError } from "./SignupValidator.js";

const SigninValidator = (data: any) => {
    // 1. Strict Type & Presence Checking
    if (!data || typeof data !== 'object') {
        throw new ValidationError("Invalid request body.");
    }

    const rawIdentity = data.gmail ?? data.identity ?? data.username ?? data.email;
    if (typeof rawIdentity !== "string" || typeof data.password !== "string") {
        throw new ValidationError("Identity and password must be valid strings.");
    }

    // 2. DoS Protection (Max Lengths)
    if (rawIdentity.length > 255) {
        throw new ValidationError("Identity is too long.");
    }
    if (data.password.length > 128) {
        throw new ValidationError("Password is too long.");
    }

    const password = data.password; // Do not mutate password

    // 3. Normalization: strip surrounding whitespace
    const normalizedIdentity = rawIdentity.trim().toLowerCase().replace(/\s/g, "");

    if (!normalizedIdentity || !password) {
        throw new ValidationError("Credentials cannot be empty.");
    }

    // 4. Format Validation: Allow valid email OR valid username/slug
    const isEmail = validator.isEmail(normalizedIdentity);
    const isValidUsername = /^[a-z0-9._-]{2,60}$/.test(normalizedIdentity);

    if (!isEmail && !isValidUsername) {
        throw new ValidationError("Please enter a valid email address or username.");
    }

    const requestedAccountType =
        data.accountType === "club" || data.loginMode === "club"
            ? ("club" as const)
            : data.accountType === "personal" || data.loginMode === "personal"
            ? ("personal" as const)
            : undefined;

    return {
        gmail: normalizedIdentity,
        password: password,
        type: isEmail ? ("gmail" as const) : ("username" as const),
        accountType: requestedAccountType,
    };
};

export default SigninValidator;