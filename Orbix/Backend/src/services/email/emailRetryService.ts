/**
 * Email Retry Service
 * Computes intelligent exponential backoff with full jitter to avoid thundering herds.
 */

export interface EmailRetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
}

export function getEmailRetryConfig(): EmailRetryConfig {
    return {
        maxAttempts: Math.max(1, parseInt(process.env.EMAIL_MAX_ATTEMPTS || "8", 10)),
        baseDelayMs: Math.max(1000, parseInt(process.env.EMAIL_RETRY_BASE_DELAY_MS || "30000", 10)), // 30s default
        maxDelayMs: Math.max(5000, parseInt(process.env.EMAIL_RETRY_MAX_DELAY_MS || "21600000", 10)), // 6h default
        jitter: process.env.EMAIL_RETRY_JITTER !== "false",
    };
}

/**
 * Calculates next retry delay in milliseconds using exponential backoff with jitter:
 * delay = random(0, min(maxDelay, baseDelay * 2^(attempt - 1)))
 */
export function calculateBackoffDelay(attemptNumber: number, configOverride?: Partial<EmailRetryConfig>): number {
    const config = { ...getEmailRetryConfig(), ...configOverride };
    const attempt = Math.max(1, attemptNumber);

    // Exponential factor: 2^(attempt - 1)
    const exponentialFactor = Math.pow(2, attempt - 1);
    const calculatedDelay = Math.min(config.maxDelayMs, config.baseDelayMs * exponentialFactor);

    if (!config.jitter) {
        return Math.floor(calculatedDelay);
    }

    // Full Jitter: randomize between 0 and calculatedDelay
    // Ensure at least 25% minimum delay so retry doesn't happen instantly
    const minJitter = Math.floor(calculatedDelay * 0.25);
    const randomRange = calculatedDelay - minJitter;
    return minJitter + Math.floor(Math.random() * randomRange);
}

/**
 * Returns the timestamp when the next attempt should occur
 */
export function calculateNextAttemptDate(attemptNumber: number, configOverride?: Partial<EmailRetryConfig>): Date {
    const delayMs = calculateBackoffDelay(attemptNumber, configOverride);
    return new Date(Date.now() + delayMs);
}
