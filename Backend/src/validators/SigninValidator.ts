import validator from "validator";
import { ValidationError } from "./SignupValidator.js";

const SigninValidator = (data: any) => {
    // 1. Strict Type & Presence Checking
    if (!data || typeof data !== 'object') {
        throw new ValidationError("Invalid request body.");
    }

    if (typeof data.gmail !== "string" || typeof data.password !== "string") {
        throw new ValidationError("Identity and password must be valid strings.");
    }

    // 2. DoS Protection (Max Lengths)
    if (data.gmail.length > 255) {
        throw new ValidationError("Identity is too long.");
    }
    if (data.password.length > 128) {
        throw new ValidationError("Password is too long.");
    }

    const password = data.password; // Do not mutate password

    // 3. Normalization
    const normalizedGmail = data.gmail.trim().toLowerCase().replace(/\s/g, "");

    if (!normalizedGmail || !password) {
        throw new ValidationError("Credentials cannot be empty.");
    }

    // 4. Format Validation: Allow valid email OR valid username
    const isEmail = validator.isEmail(normalizedGmail);
    const isValidUsername = /^[a-z0-9._-]{2,30}$/.test(normalizedGmail);

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
        gmail: normalizedGmail,
        password: password,
        type: isEmail ? "gmail" : "username" as const,
        accountType: requestedAccountType,
    };

};

export default SigninValidator;