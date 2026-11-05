/**
 * Form Studio & Registration Observability Logger
 * Production-grade structured logging for form operations, concurrency conflicts, and performance monitoring.
 *
 * Strict Privacy Rule: NEVER logs passwords, tokens, student answer contents, or confidential attachments.
 */

export type FormEventType =
    | "FORM_CREATION_FAILED"
    | "AUTOSAVE_FAILED"
    | "FORM_PUBLISH_ERROR"
    | "INVALID_SUBMISSION"
    | "DUPLICATE_REGISTRATION"
    | "CAPACITY_CONFLICT"
    | "UPLOAD_FAILURE"
    | "EXPORT_FAILURE"
    | "DB_ERROR"
    | "REGISTRATION_SUBMITTED"
    | "REGISTRATION_CANCELLED"
    | "CACHE_HIT"
    | "CACHE_MISS"
    | "CACHE_INVALIDATED"
    | "FORM_SECURITY_VIOLATION"
    | "RATE_LIMIT_EXCEEDED";

export interface FormLogContext {
    eventId?: string | undefined;
    clubId?: string | undefined;
    userId?: string | undefined;
    durationMs?: number | undefined;
    meta?: Record<string, any> | undefined;
}

const SENSITIVE_KEYS = new Set([
    "password",
    "token",
    "authorization",
    "auth",
    "cookie",
    "answers",
    "formresponse",
    "form_response",
    "fileattachments",
    "file_attachments",
    "secret",
    "apikey",
    "api_key",
]);

/**
 * Recursively redacts sensitive payload properties to prevent confidential data leaks into log streams.
 */
function sanitizeMeta(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeMeta(item));
    }

    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey)) {
            if (val && typeof val === "object") {
                clean[`${key}_count`] = Array.isArray(val) ? val.length : Object.keys(val).length;
            } else {
                clean[key] = "[REDACTED]";
            }
        } else if (typeof val === "object" && val !== null) {
            clean[key] = sanitizeMeta(val);
        } else {
            clean[key] = val;
        }
    }
    return clean;
}

export class FormLogger {
    private static formatLog(
        level: "INFO" | "WARN" | "ERROR",
        event: FormEventType,
        message: string,
        context?: FormLogContext,
        error?: any
    ): string {
        const entry: Record<string, any> = {
            timestamp: new Date().toISOString(),
            service: "orbix-form-service",
            level,
            event,
            message,
            eventId: context?.eventId,
            clubId: context?.clubId,
            userId: context?.userId,
            durationMs: context?.durationMs,
        };

        if (context?.meta) {
            entry.metadata = sanitizeMeta(context.meta);
        }

        if (error) {
            entry.error = {
                name: error.name || "Error",
                message: error.message,
                statusCode: error.statusCode,
                code: error.code,
                stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
            };
        }

        return JSON.stringify(entry);
    }

    static info(event: FormEventType, message: string, context?: FormLogContext) {
        console.log(this.formatLog("INFO", event, message, context));
    }

    static warn(event: FormEventType, message: string, context?: FormLogContext) {
        console.warn(this.formatLog("WARN", event, message, context));
    }

    static error(event: FormEventType, message: string, context?: FormLogContext, error?: any) {
        console.error(this.formatLog("ERROR", event, message, context, error));
    }
}
