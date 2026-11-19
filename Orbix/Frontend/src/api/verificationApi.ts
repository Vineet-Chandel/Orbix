// Frontend/src/api/verificationApi.ts

const API_BASE = "/api/settings/verification";

function getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

export interface VerificationStatusResponse {
    success: boolean;
    email: string;
    isEmailVerified: boolean;
    emailVerifiedAt: string | null;
    hasPendingOtp: boolean;
    cooldownRemainingSeconds: number;
    simulated?: boolean;
    message?: string;
}

export interface SendOtpResponse {
    success: boolean;
    message: string;
    email: string;
    simulated?: boolean;
    cooldownSeconds: number;
    expiresInSeconds: number;
}

export interface VerifyOtpResponse {
    success: boolean;
    message: string;
    isEmailVerified: boolean;
    emailVerifiedAt: string;
    email: string;
}

/**
 * Fetches the current email verification state for the authenticated user.
 */
export async function fetchVerificationStatus(): Promise<VerificationStatusResponse> {
    const res = await fetch(`${API_BASE}/status`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Failed to fetch verification status (${res.status})`);
    }

    return data;
}

/**
 * Requests a new 6-digit verification OTP code via Resend.
 */
export async function sendVerificationOtp(email?: string): Promise<SendOtpResponse> {
    const res = await fetch(`${API_BASE}/send-otp`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(email ? { email } : {}),
    });

    const data = await res.json();
    if (!res.ok) {
        const error: any = new Error(data?.message || `Failed to send verification code (${res.status})`);
        error.cooldownRemainingSeconds = data?.cooldownRemainingSeconds || 0;
        throw error;
    }

    return data;
}

/**
 * Verifies the 6-digit verification code.
 */
export async function verifyEmailOtp(otp: string): Promise<VerifyOtpResponse> {
    const res = await fetch(`${API_BASE}/verify-otp`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ otp }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Verification failed (${res.status})`);
    }

    return data;
}
