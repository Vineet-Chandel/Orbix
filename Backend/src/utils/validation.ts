/**
 * Backend/src/utils/validation.ts
 * High-performance, zero-dependency validation suite replacing external 'validator' package.
 * Leverages native Node.js / ECMAScript runtime primitives (URL, RegExp, String).
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface StrongPasswordOptions {
    minLength?: number;
    minLowercase?: number;
    minUppercase?: number;
    minNumbers?: number;
    minSymbols?: number;
}

export interface IsURLOptions {
    protocols?: string[];
    require_protocol?: boolean;
}

/**
 * Validates that an input is a structurally valid email address.
 */
export function isEmail(str: string): boolean {
    if (typeof str !== "string" || str.length === 0 || str.length > 320) {
        return false;
    }
    return EMAIL_REGEX.test(str.trim());
}

/**
 * Validates that an input is a parseable HTTP/HTTPS URL.
 */
export function isURL(str: string, options: IsURLOptions = {}): boolean {
    if (typeof str !== "string" || str.trim().length === 0) {
        return false;
    }
    const trimmed = str.trim();
    try {
        const parsed = new URL(trimmed);
        const protocols = options.protocols || ["http", "https"];
        const protoClean = parsed.protocol.replace(":", "").toLowerCase();
        return protocols.includes(protoClean);
    } catch {
        return false;
    }
}

/**
 * Tests whether a string matches a RegExp pattern.
 */
export function matches(str: string, pattern: RegExp | string): boolean {
    if (typeof str !== "string") return false;
    if (pattern instanceof RegExp) {
        return pattern.test(str);
    }
    return new RegExp(pattern).test(str);
}

/**
 * Validates password strength:
 * Minimum 8 characters, at least 1 lowercase, 1 uppercase, 1 digit, and 1 symbol.
 */
export function isStrongPassword(password: string, options: StrongPasswordOptions = {}): boolean {
    if (typeof password !== "string") return false;

    const minLength = options.minLength ?? 8;
    const minLowercase = options.minLowercase ?? 1;
    const minUppercase = options.minUppercase ?? 1;
    const minNumbers = options.minNumbers ?? 1;
    const minSymbols = options.minSymbols ?? 1;

    if (password.length < minLength) return false;

    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    if (lowercaseCount < minLowercase) return false;

    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    if (uppercaseCount < minUppercase) return false;

    const numberCount = (password.match(/[0-9]/g) || []).length;
    if (numberCount < minNumbers) return false;

    const symbolCount = (password.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (symbolCount < minSymbols) return false;

    return true;
}

/**
 * Default export providing 1:1 drop-in compatibility for `import validator from ...`
 */
const validator = {
    isEmail,
    isURL,
    matches,
    isStrongPassword,
};

export default validator;
