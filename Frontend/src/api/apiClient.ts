/**
 * Orbix Standardized API Client
 *
 * Enforces mandatory /api prefix routing across all frontend requests.
 * Eliminates duplicate prefixes (/api/api) and hardcoded localhost/IP URLs.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

/**
 * Normalizes any relative or absolute path to a clean /api endpoint.
 * - "/auth/signin" -> "/api/auth/signin"
 * - "/api/auth/signin" -> "/api/auth/signin"
 * - "profile/me" -> "/api/profile/me"
 */
export function buildApiUrl(path: string): string {
    if (!path) return API_BASE_URL;
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (cleanPath.startsWith("/api/") || cleanPath === "/api") {
        return cleanPath;
    }
    return `${API_BASE_URL}${cleanPath}`;
}

export function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token");
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }
    return headers;
}

export interface ApiFetchOptions extends RequestInit {
    params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T = any>(
    path: string,
    options: ApiFetchOptions = {}
): Promise<T> {
    const { params, headers, ...restOptions } = options;
    let url = buildApiUrl(path);

    if (params) {
        const searchParams = new URLSearchParams();
        for (const [key, val] of Object.entries(params)) {
            if (val !== undefined && val !== null) {
                searchParams.append(key, String(val));
            }
        }
        const qs = searchParams.toString();
        if (qs) {
            url += (url.includes("?") ? "&" : "?") + qs;
        }
    }

    const mergedHeaders: Record<string, string> = {
        ...getAuthHeaders(),
        ...((headers as Record<string, string>) || {}),
    };

    // If body is FormData, delete Content-Type so browser sets boundary multipart automatically
    if (restOptions.body instanceof FormData) {
        delete mergedHeaders["Content-Type"];
    }

    const response = await fetch(url, {
        ...restOptions,
        headers: mergedHeaders,
        credentials: "include",
    });

    if (!response.ok) {
        let errMessage = `Request failed with status ${response.status}`;
        try {
            const errData = await response.json();
            errMessage = errData.message || errData.error || errMessage;
        } catch {
            // response was not JSON
        }
        const error = new Error(errMessage) as any;
        error.status = response.status;
        throw error;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
}

export const apiClient = {
    get: <T = any>(url: string, options?: ApiFetchOptions) =>
        apiFetch<T>(url, { ...options, method: "GET" }),
    post: <T = any>(url: string, data?: any, options?: ApiFetchOptions) =>
        apiFetch<T>(url, {
            ...options,
            method: "POST",
            body: data instanceof FormData ? data : JSON.stringify(data),
        }),
    put: <T = any>(url: string, data?: any, options?: ApiFetchOptions) =>
        apiFetch<T>(url, {
            ...options,
            method: "PUT",
            body: data instanceof FormData ? data : JSON.stringify(data),
        }),
    patch: <T = any>(url: string, data?: any, options?: ApiFetchOptions) =>
        apiFetch<T>(url, {
            ...options,
            method: "PATCH",
            body: data instanceof FormData ? data : JSON.stringify(data),
        }),
    delete: <T = any>(url: string, options?: ApiFetchOptions) =>
        apiFetch<T>(url, { ...options, method: "DELETE" }),
    url: buildApiUrl,
};

export default apiClient;
