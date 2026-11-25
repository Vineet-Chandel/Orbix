export type PortalFetchErrorCategory =
    | "ACCOUNT_NOT_FOUND"
    | "PLATFORM_UNAVAILABLE"
    | "RATE_LIMITED"
    | "NETWORK_ERROR"
    | "PARSE_ERROR"
    | "UNKNOWN_ERROR";

export interface NormalizedPortalError {
    category: PortalFetchErrorCategory;
    badgeLabel: string;
    message: string;
}

/**
 * Normalizes an API response, HTTP status code, or network error into a single cohesive
 * error representation where badge and user message are guaranteed to agree.
 *
 * Expected presentation:
 * - ACCOUNT_NOT_FOUND: Badge "Account Not Found" | Message "Account not found on [platform]. Check the username or profile link."
 * - PLATFORM_UNAVAILABLE: Badge "Platform Unavailable" | Message "[platform] is temporarily unavailable or blocking automated requests. Please try again later."
 * - RATE_LIMITED: Badge "Rate Limited" | Message "Too many requests. Please wait before trying again."
 * - NETWORK_ERROR: Badge "Network Error" | Message "Unable to connect to [platform]. Please try again."
 * - PARSE_ERROR: Badge "Parse Error" | Message "[platform]'s profile response could not be interpreted. Please try again later."
 * - UNKNOWN_ERROR: Badge "Error" | Message "Something went wrong. Please try again." (NEVER "Account Not Found")
 */
export function normalizePortalError(
    status: number | null | undefined,
    errJson: any,
    platformName: string
): NormalizedPortalError {
    const rawCode = errJson?.code ? String(errJson.code).toUpperCase().trim() : "";
    const rawMsg = errJson?.message && typeof errJson.message === "string" ? errJson.message.trim() : "";
    const isGenericServerError = rawMsg.toLowerCase().includes("something went wrong");

    let category: PortalFetchErrorCategory;

    // 1. Explicit backend machine error code matching
    if (rawCode === "ACCOUNT_NOT_FOUND") {
        category = "ACCOUNT_NOT_FOUND";
    } else if (rawCode === "PLATFORM_UNAVAILABLE") {
        category = "PLATFORM_UNAVAILABLE";
    } else if (rawCode === "RATE_LIMITED") {
        category = "RATE_LIMITED";
    } else if (rawCode === "NETWORK_ERROR") {
        category = "NETWORK_ERROR";
    } else if (rawCode === "PARSE_ERROR") {
        category = "PARSE_ERROR";
    }
    // 2. Standard HTTP status matching when code is missing or unmapped
    else if (status === 404) {
        category = "ACCOUNT_NOT_FOUND";
    } else if (status === 429) {
        category = "RATE_LIMITED";
    } else if (status === 503 || status === 403) {
        category = "PLATFORM_UNAVAILABLE";
    } else if (status === 502) {
        category = "PARSE_ERROR";
    } else if (status === 504 || status === 0) {
        category = "NETWORK_ERROR";
    }
    // 3. Fallback message inspection for un-coded network / anti-bot challenge responses
    else if (
        rawMsg.toLowerCase().includes("anti-bot") ||
        rawMsg.toLowerCase().includes("recaptcha") ||
        rawMsg.toLowerCase().includes("restricting automated") ||
        rawMsg.toLowerCase().includes("blocking automated") ||
        rawMsg.toLowerCase().includes("temporarily unavailable")
    ) {
        category = "PLATFORM_UNAVAILABLE";
    } else if (rawMsg.toLowerCase().includes("rate limit")) {
        category = "RATE_LIMITED";
    } else if (
        rawMsg.toLowerCase().includes("network error") ||
        rawMsg.toLowerCase().includes("timed out") ||
        rawMsg.toLowerCase().includes("timeout") ||
        rawMsg.toLowerCase().includes("connection")
    ) {
        category = "NETWORK_ERROR";
    } else if (
        rawMsg.toLowerCase().includes("parse") ||
        rawMsg.toLowerCase().includes("profile structure") ||
        rawMsg.toLowerCase().includes("layout")
    ) {
        category = "PARSE_ERROR";
    } else if (rawMsg.toLowerCase().includes("not found") && !isGenericServerError && status !== 500) {
        category = "ACCOUNT_NOT_FOUND";
    } else {
        category = "UNKNOWN_ERROR";
    }

    // Build strictly paired badge and user message
    switch (category) {
        case "ACCOUNT_NOT_FOUND":
            return {
                category,
                badgeLabel: "Account Not Found",
                message:
                    rawMsg && !isGenericServerError
                        ? rawMsg
                        : `Account not found on ${platformName}. Check the username or profile link.`,
            };
        case "PLATFORM_UNAVAILABLE":
            return {
                category,
                badgeLabel: "Platform Unavailable",
                message:
                    rawMsg && !isGenericServerError
                        ? rawMsg
                        : `${platformName} is temporarily unavailable or blocking automated requests. Please try again later.`,
            };
        case "RATE_LIMITED":
            return {
                category,
                badgeLabel: "Rate Limited",
                message:
                    rawMsg && !isGenericServerError
                        ? rawMsg
                        : "Too many requests. Please wait before trying again.",
            };
        case "NETWORK_ERROR":
            return {
                category,
                badgeLabel: "Network Error",
                message:
                    rawMsg && !isGenericServerError
                        ? rawMsg
                        : `Unable to connect to ${platformName}. Please try again.`,
            };
        case "PARSE_ERROR":
            return {
                category,
                badgeLabel: "Parse Error",
                message:
                    rawMsg && !isGenericServerError
                        ? rawMsg
                        : `${platformName}'s profile response could not be interpreted. Please try again later.`,
            };
        case "UNKNOWN_ERROR":
        default:
            return {
                category: "UNKNOWN_ERROR",
                badgeLabel: "Error",
                message:
                    rawMsg || "Something went wrong. Please try again.",
            };
    }
}
