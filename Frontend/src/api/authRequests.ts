import { buildApiUrl } from "./apiClient";

export const SIGNED_OUT_KEY = "orbix_signed_out";
let pendingSignOut: Promise<unknown> | null = null;

/** Deadline covers response headers AND body; authentication requests are never retried. */
export async function requestAuthJson(url: string, options: RequestInit = {}, timeoutMs = 30000) {
    if (url.endsWith("/signin") && pendingSignOut) await pendingSignOut.catch(() => undefined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("The connection is taking too long. Please try again.", "TimeoutError")), timeoutMs);
    try {
        const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
        const response = await fetch(url, { ...options, signal });
        let data: any;
        try {
            data = await response.json();
        } catch (error) {
            if (signal.aborted) throw error;
            throw new Error(response.ok
                ? "The authentication server returned an incomplete response. Please try again."
                : `The authentication service is unavailable (${response.status}). Please try again.`);
        }
        return { response, data };
    } catch (error) {
        if (controller.signal.aborted) throw new Error("The connection is taking too long. Please check your network and try again.");
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/** Start server revocation immediately, while the caller clears local state and navigates. */
export function beginSignOut(): Promise<unknown> {
    if (pendingSignOut) return pendingSignOut;
    let token: string | null = null;
    try {
        token = localStorage.getItem("orbix_token");
        localStorage.setItem(SIGNED_OUT_KEY, "1");
    } catch { /* Storage can be disabled. Redux still clears the local session. */ }
    const request = requestAuthJson(buildApiUrl("/api/auth/logout"), {
        method: "POST", credentials: "include", keepalive: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, 8000).then(({ response }) => {
        if (!response.ok) throw new Error("Server sign-out could not be confirmed. You are signed out on this device.");
    });
    pendingSignOut = request;
    void request.finally(() => { if (pendingSignOut === request) pendingSignOut = null; }).catch(() => undefined);
    return request;
}
