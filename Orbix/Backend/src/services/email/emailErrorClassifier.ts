/**
 * Email Error Classifier
 * Centralized failure classifier that categorizes errors into:
 * - TRANSIENT: Retryable with exponential backoff (rate limits, timeouts, 5xx, network drops)
 * - PERMANENT_RECIPIENT: Non-retryable recipient defects (invalid email, suppressed, sandbox test restriction)
 * - SYSTEMIC: Infrastructure/credential/code errors (missing API keys, syntax errors)
 */

export type EmailFailureCategory = "TRANSIENT" | "PERMANENT_RECIPIENT" | "SYSTEMIC";

export interface ClassifiedEmailError {
    category: EmailFailureCategory;
    isRetryable: boolean;
    code: string;
    message: string;
    stack?: string | undefined;
    providerDetails?: Record<string, any> | undefined;
}

export function classifyEmailError(err: any): ClassifiedEmailError {
    const rawMessage = String(err?.message || err?.error || err || "Unknown email error");
    const safeMessage = rawMessage.slice(0, 1000);
    const code = String(err?.code || err?.statusCode || err?.status || "UNKNOWN_ERROR").toUpperCase();
    const stack = typeof err?.stack === "string" ? err.stack.slice(0, 2000) : undefined;

    const lowerMsg = safeMessage.toLowerCase();

    // 1. Permanent Recipient Failures (Do NOT retry indefinitely)
    if (
        lowerMsg.includes("invalid email") ||
        lowerMsg.includes("recipient address rejected") ||
        lowerMsg.includes("is not a valid email") ||
        lowerMsg.includes("unsubscribed") ||
        lowerMsg.includes("suppressed") ||
        lowerMsg.includes("hard bounce") ||
        lowerMsg.includes("email was suppressed") ||
        lowerMsg.includes("can only send testing emails to your own email address") || // Resend sandbox restriction
        code === "INVALID_EMAIL" ||
        code === "RECIPIENT_SUPPRESSED" ||
        code === "422" ||
        code === "400"
    ) {
        return {
            category: "PERMANENT_RECIPIENT",
            isRetryable: false,
            code: code === "UNKNOWN_ERROR" ? "PERMANENT_RECIPIENT_ERROR" : code,
            message: safeMessage,
            stack,
            providerDetails: typeof err === "object" ? { ...err } : undefined,
        };
    }

    // 2. Systemic Failures (Credential / Database / Application bug)
    if (
        lowerMsg.includes("api key") ||
        lowerMsg.includes("unauthorized") ||
        lowerMsg.includes("forbidden") ||
        lowerMsg.includes("operator does not exist") || // PostgreSQL type mismatch
        lowerMsg.includes("syntax error") ||
        lowerMsg.includes("column does not exist") ||
        code === "401" ||
        code === "403" ||
        code === "42883" // Postgres undefined operator
    ) {
        return {
            category: "SYSTEMIC",
            isRetryable: false,
            code: code === "UNKNOWN_ERROR" ? "SYSTEMIC_CONFIG_ERROR" : code,
            message: safeMessage,
            stack,
            providerDetails: typeof err === "object" ? { ...err } : undefined,
        };
    }

    // 3. Transient Failures (Retryable with exponential backoff)
    // - HTTP 429 Rate limits
    // - HTTP 500, 502, 503, 504 Provider gateway errors
    // - Network connection resets, timeouts (ETIMEDOUT, ECONNRESET, ECONNREFUSED)
    // - SMTP 4xx temporary deferrals
    return {
        category: "TRANSIENT",
        isRetryable: true,
        code: code === "UNKNOWN_ERROR" ? "TRANSIENT_NETWORK_ERROR" : code,
        message: safeMessage,
        stack,
        providerDetails: typeof err === "object" ? { ...err } : undefined,
    };
}
