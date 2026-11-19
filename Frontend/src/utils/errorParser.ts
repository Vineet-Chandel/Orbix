export interface ParsedError {
    title: string;
    message: string;
    statusCode?: number;
}

/**
 * Production-level error parser that safely extracts human-readable
 * titles and messages from any error shape (Fetch responses, Error instances,
 * backend JSON payloads, network failures, strings, etc.)
 */
export async function parseError(
    error: unknown,
    fallbackTitle = "Action Failed",
    fallbackMessage = "An unexpected error occurred. Please try again."
): Promise<ParsedError> {
    // 1. Handle Fetch Response objects directly
    if (error instanceof Response) {
        const statusCode = error.status;
        let title = "Error";
        let message = fallbackMessage;

        try {
            const data = await error.clone().json();
            if (data) {
                if (typeof data.message === "string") {
                    message = data.message;
                } else if (typeof data.error === "string") {
                    message = data.error;
                } else if (Array.isArray(data.errors) && data.errors.length > 0) {
                    message = data.errors.map((e: any) => (typeof e === "string" ? e : e.message || JSON.stringify(e))).join(", ");
                } else if (typeof data.detail === "string") {
                    message = data.detail;
                }
            }
        } catch {
            // Not JSON (e.g. text or HTML response)
            try {
                const text = await error.clone().text();
                if (text && text.length < 200 && !text.includes("<html")) {
                    message = text;
                }
            } catch {
                // Ignore text read error
            }
        }

        // Contextual title based on HTTP status code
        switch (statusCode) {
            case 400:
                title = "Invalid Request";
                break;
            case 401:
                title = "Authentication Failed";
                if (message === fallbackMessage) message = "Invalid email or password.";
                break;
            case 403:
                title = "Access Denied";
                break;
            case 404:
                title = "Resource Not Found";
                break;
            case 409:
                title = "Account Conflict";
                if (message === fallbackMessage) message = "Username or email already exists!";
                break;
            case 422:
                title = "Validation Failed";
                break;
            case 429:
                title = "Rate Limit Exceeded";
                if (message === fallbackMessage) message = "Too many attempts. Please try again later.";
                break;
            case 500:
            case 502:
            case 503:
            case 504:
                title = "Server Error";
                message = "The server is temporarily unavailable. Please try again shortly.";
                break;
            default:
                title = fallbackTitle;
                break;
        }

        return { title, message, statusCode };
    }

    // 2. Handle JS Error instances (e.g. TypeError, network failures)
    if (error instanceof Error) {
        const rawMessage = error.message;

        // Detect network / connection failures
        if (
            rawMessage.includes("Failed to fetch") ||
            rawMessage.includes("NetworkError") ||
            rawMessage.includes("Load failed") ||
            rawMessage.includes("ECONNREFUSED") ||
            rawMessage.includes("fetch failed")
        ) {
            return {
                title: "Connection Failed",
                message: "Unable to connect to the server. Please check your internet connection or backend status.",
            };
        }

        return {
            title: error.name !== "Error" ? error.name : fallbackTitle,
            message: rawMessage || fallbackMessage,
        };
    }

    // 3. Handle Object shapes (e.g. { message, error, status })
    if (typeof error === "object" && error !== null) {
        const errObj = error as Record<string, any>;
        const message =
            (typeof errObj.message === "string" && errObj.message) ||
            (typeof errObj.error === "string" && errObj.error) ||
            (typeof errObj.detail === "string" && errObj.detail) ||
            (Array.isArray(errObj.errors) ? errObj.errors.join(", ") : null) ||
            fallbackMessage;

        const title =
            (typeof errObj.title === "string" && errObj.title) ||
            (typeof errObj.name === "string" && errObj.name) ||
            fallbackTitle;

        return {
            title,
            message,
            statusCode: typeof errObj.status === "number" ? errObj.status : undefined,
        };
    }

    // 4. Handle simple string errors
    if (typeof error === "string") {
        return {
            title: fallbackTitle,
            message: error.trim() || fallbackMessage,
        };
    }

    // 5. Ultimate fallback
    return {
        title: fallbackTitle,
        message: fallbackMessage,
    };
}
