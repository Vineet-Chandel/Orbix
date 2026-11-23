/**
 * ORBIX PLATFORM OWNERSHIP VERIFICATION API CLIENT
 * Connects frontend to Phase 1-3 backend verification endpoints:
 * - POST /api/portals/verification/initiate
 * - POST /api/portals/verification/confirm
 * - POST /api/portals/verification/cancel
 */

import { buildApiUrl, getAuthHeaders } from "./apiClient";

/** Starts authenticated account linking, rather than GitHub login/signup. */
export async function startGitHubOwnershipVerification(portalUsername: string, returnTo: string): Promise<string> {
    const response = await fetch(buildApiUrl("/api/auth/github/link"), {
        method: "POST",
        credentials: "include",
        redirect: "error",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ portalUsername, returnTo }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.url) {
        throw new Error(data?.message || "Could not start GitHub verification. Please retry.");
    }
    const destination = new URL(data.url);
    if (destination.protocol !== "https:" || destination.hostname !== "github.com" || destination.pathname !== "/login/oauth/authorize") {
        throw new Error("Could not open GitHub authorization. Please retry.");
    }
    return destination.href;
}
import type {
    InitiateVerificationPayload,
    InitiateVerificationSuccessResponse,
    ConfirmVerificationPayload,
    ConfirmVerificationSuccessResponse,
    CancelVerificationPayload,
    CancelVerificationResponse,
    PlatformVerificationError,
    VerificationErrorCode,
} from "../types/platformVerification";

export class VerificationApiError extends Error implements PlatformVerificationError {
    public code: VerificationErrorCode | string;
    public status: number;
    public resetInSeconds?: number;
    public attemptsRemaining?: number;
    public requiresOAuth?: boolean;
    public oauthUrl?: string;
    public supportedPlatforms?: string[];

    constructor(
        message: string,
        status: number,
        code: VerificationErrorCode | string = "SERVER_ERROR",
        details: Partial<PlatformVerificationError> = {}
    ) {
        super(message);
        this.name = "VerificationApiError";
        this.status = status;
        this.code = code;
        this.resetInSeconds = details.resetInSeconds;
        this.attemptsRemaining = details.attemptsRemaining;
        this.requiresOAuth = details.requiresOAuth;
        this.oauthUrl = details.oauthUrl;
        this.supportedPlatforms = details.supportedPlatforms;
    }
}

function parseErrorResponse(status: number, data: Record<string, unknown> | null | undefined): VerificationApiError {
    const rawMessage = (data?.message || data?.error || `Verification request failed with status ${status}`) as string;
    const code = (data?.code as VerificationErrorCode) || (status === 429 ? "RATE_LIMIT_EXCEEDED" : status === 503 ? "SERVICE_UNAVAILABLE" : "SERVER_ERROR");

    // Extract resetInSeconds from data or regex match from message
    let resetInSeconds = data?.resetInSeconds as number | undefined;
    if (resetInSeconds === undefined && typeof rawMessage === "string") {
        const match = rawMessage.match(/wait\s+(\d+)\s+seconds/i);
        if (match) {
            resetInSeconds = parseInt(match[1], 10);
        }
    }

    return new VerificationApiError(rawMessage, status, code, {
        resetInSeconds,
        attemptsRemaining: data?.attemptsRemaining as number | undefined,
        requiresOAuth: data?.requiresOAuth as boolean | undefined,
        oauthUrl: data?.oauthUrl as string | undefined,
        supportedPlatforms: data?.supportedPlatforms as string[] | undefined,
    });
}

/**
 * Initiates ownership verification challenge.
 * Returns server-generated instructions, target field, token, and expiry.
 * Plaintext token is returned ONLY once.
 */
export async function initiateVerification(
    payload: InitiateVerificationPayload
): Promise<InitiateVerificationSuccessResponse> {
    const cleanPortal = String(payload.portal || "").trim().toLowerCase();
    const cleanUsername = String(payload.portalUsername || "").trim();

    if (!cleanPortal || !cleanUsername) {
        throw new VerificationApiError("Platform and username are required", 400, "INVALID_INPUT");
    }

    const endpoint = buildApiUrl("/api/portals/verification/initiate");
    let response: Response;

    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify({
                portal: cleanPortal,
                portalUsername: cleanUsername,
                targetField: payload.targetField,
            }),
        });
    } catch {
        throw new VerificationApiError(
            "Network connection failed while initiating verification. Please check your connection and retry.",
            0,
            "NETWORK_ERROR"
        );
    }

    let data: Record<string, unknown>;
    try {
        data = await response.json();
    } catch {
        throw new VerificationApiError(
            `Server returned non-JSON response (${response.status})`,
            response.status,
            "SERVER_ERROR"
        );
    }

    if (!response.ok || !data.success) {
        throw parseErrorResponse(response.status, data);
    }

    return data as unknown as InitiateVerificationSuccessResponse;
}

/**
 * Confirms external profile challenge.
 * The backend independently crawls the external profile and verifies candidate token match.
 */
export async function confirmVerification(
    payload: ConfirmVerificationPayload
): Promise<ConfirmVerificationSuccessResponse> {
    const cleanPortal = String(payload.portal || "").trim().toLowerCase();
    if (!cleanPortal) {
        throw new VerificationApiError("Platform is required", 400, "INVALID_INPUT");
    }

    const endpoint = buildApiUrl("/api/portals/verification/confirm");
    let response: Response;

    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify({
                portal: cleanPortal,
                portalUsername: payload.portalUsername ? String(payload.portalUsername).trim() : undefined,
            }),
        });
    } catch {
        throw new VerificationApiError(
            "Network connection failed while confirming verification. Please check your connection and retry.",
            0,
            "NETWORK_ERROR"
        );
    }

    let data: Record<string, unknown>;
    try {
        data = await response.json();
    } catch {
        throw new VerificationApiError(
            `Server returned non-JSON response (${response.status})`,
            response.status,
            "SERVER_ERROR"
        );
    }

    if (!response.ok || !data.verified) {
        throw parseErrorResponse(response.status, data);
    }

    return data as unknown as ConfirmVerificationSuccessResponse;
}

/**
 * Cancels an active pending verification challenge.
 */
export async function cancelVerification(
    payload: CancelVerificationPayload
): Promise<CancelVerificationResponse> {
    const cleanPortal = String(payload.portal || "").trim().toLowerCase();
    if (!cleanPortal) {
        throw new VerificationApiError("Platform is required", 400, "INVALID_INPUT");
    }

    const endpoint = buildApiUrl("/api/portals/verification/cancel");
    let response: Response;

    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify({ portal: cleanPortal }),
        });
    } catch {
        throw new VerificationApiError(
            "Network connection failed while cancelling verification.",
            0,
            "NETWORK_ERROR"
        );
    }

    let data: Record<string, unknown>;
    try {
        data = await response.json();
    } catch {
        throw new VerificationApiError(
            `Server returned non-JSON response (${response.status})`,
            response.status,
            "SERVER_ERROR"
        );
    }

    if (!response.ok) {
        throw parseErrorResponse(response.status, data);
    }

    return data as unknown as CancelVerificationResponse;
}
