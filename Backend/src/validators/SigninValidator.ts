import validator from "validator";
import { ValidationError } from "./SignupValidator.js";

const SigninValidator = (data: any) => {
    // 1. Strict Type & Presence Checking
    if (!data || typeof data !== 'object') {
        throw new ValidationError("Invalid request body.");
    }

    if (typeof data.identity !== "string" || typeof data.password !== "string") {
        throw new ValidationError("Identity and password must be valid strings.");
    }

    // 2. DoS Protection (Max Lengths)
    if (data.identity.length > 255) {
        throw new ValidationError("Identity is too long.");
    }
    if (data.password.length > 128) {
        throw new ValidationError("Password is too long.");
    }

    const password = data.password; // Do not mutate password

    // 3. Normalization
    const normalizedIdentity = data.identity.trim().toLowerCase().replace(/\s/g, "");

    if (!normalizedIdentity || !password) {
        throw new ValidationError("Credentials cannot be empty.");
    }

    // 4. Format Validation
    if (validator.isEmail(normalizedIdentity)) {
        return {
            identity: normalizedIdentity,
            password: password,
            type: "gmail" as const
        };
    }

    if (!validator.matches(normalizedIdentity, /^[a-z0-9._]{3,20}$/)) {
        throw new ValidationError("Invalid credentials.");
    }

    return {
        identity: normalizedIdentity,
        password: password,
        type: "username" as const
    };
};

export default SigninValidator;