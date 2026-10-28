// Frontend/src/api/manageAccountApi.ts

const API_BASE = "/api/settings/manage-account";

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

export interface MonthlyQuota {
    used: number;
    limit: number;
    remaining: number;
    canChange: boolean;
    nextResetAt: string;
}

export interface PendingOperation {
    id: string;
    changeType: "email_change" | "username_change";
    stage: "old_email_authorization_pending" | "new_email_verification_pending" | "authorization_pending";
    currentValue: string;
    requestedValue: string;
    expiresAt: string;
    cooldownRemainingSeconds: number;
    attemptsRemaining: number;
    createdAt: string;
}

export interface ManageAccountsStatus {
    success: boolean;
    primaryEmail: string;
    isEmailVerified: boolean;
    emailVerifiedAt: string | null;
    username: string;
    usernameUpdatedAt: string | null;
    pendingEmail: string | null;
    pendingOperation: PendingOperation | null;
    monthlyLimits: {
        email: MonthlyQuota;
        username: MonthlyQuota;
    };
    unverifiedPrimaryCooldownSeconds: number;
}

export interface AccountChangeResult {
    success: boolean;
    message: string;
    operationId?: string;
    stage?: string;
    pendingEmail?: string;
    cooldownSeconds?: number;
    expiresAt?: string;
    simulated?: boolean;
    devOtp?: string;
    token?: string;
    refreshToken?: string;
    primaryEmail?: string;
    username?: string;
    isEmailVerified?: boolean;
    user?: any;
    attemptsRemaining?: number;
    code?: string;
    limit?: number;
    action?: string;
    nextEligibleAt?: string;
    stepUpType?: "email_otp" | "password";
}

export interface UsernameAvailabilityResult {
    success: boolean;
    available: boolean;
    isCurrent?: boolean;
    reason?: string;
}

/**
 * Fetches the complete authoritative Manage Accounts status.
 */
export async function fetchManageAccountsStatus(): Promise<ManageAccountsStatus> {
    const res = await fetch(`${API_BASE}/status`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load account status.");
    }
    return data;
}

/**
 * Step 1: Initiates email change and requests authorization code for old email.
 */
export async function startEmailChange(newEmail: string): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/email/change/start`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ newEmail }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to initiate email change.");
        error.code = data?.code;
        error.limit = data?.limit;
        error.nextEligibleAt = data?.nextEligibleAt;
        error.cooldownRemainingSeconds = data?.cooldownRemainingSeconds;
        throw error;
    }
    return data;
}

/**
 * Step 2: Submits authorization OTP from old email.
 */
export async function authorizeOldEmail(operationId: string, otp: string): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/email/change/authorize-old`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ operationId, otp }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to authorize current email.");
        error.attemptsRemaining = data?.attemptsRemaining;
        throw error;
    }
    return data;
}

/**
 * Step 3: Submits verification OTP from new email and commits change atomically.
 */
export async function verifyNewEmail(operationId: string, otp: string): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/email/change/verify-new`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ operationId, otp }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to verify new email.");
        error.attemptsRemaining = data?.attemptsRemaining;
        throw error;
    }
    return data;
}

/**
 * Resends the verification code for active stage ('old' or 'new').
 */
export async function resendEmailCode(operationId: string, step: "old" | "new"): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/email/change/resend`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ operationId, step }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to resend code.");
        error.cooldownRemainingSeconds = data?.cooldownRemainingSeconds;
        throw error;
    }
    return data;
}

/**
 * Cancels active pending email change operation.
 */
export async function cancelEmailChange(operationId?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/email/change/cancel`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ operationId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to cancel email change.");
    }
    return data;
}

/**
 * Dispatches verification code for current unverified primary email.
 */
export async function sendPrimaryEmailVerification(): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/email/verify-primary/send`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to dispatch verification code.");
        error.cooldownRemainingSeconds = data?.cooldownRemainingSeconds;
        throw error;
    }
    return data;
}

/**
 * Confirms OTP for current unverified primary email.
 */
export async function confirmPrimaryEmailVerification(otp: string): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/email/verify-primary/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ otp }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Email verification failed.");
    }
    return data;
}

/**
 * Checks format and availability of a proposed username.
 */
export async function checkUsernameAvailability(username: string): Promise<UsernameAvailabilityResult> {
    const res = await fetch(`${API_BASE}/username/check?username=${encodeURIComponent(username)}`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to check username.");
    }
    return data;
}

/**
 * Step 1: Requests username change and receives step-up requirement (email_otp or password).
 */
export async function requestUsernameChange(newUsername: string): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/username/change/request`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ newUsername }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to request username change.");
        error.code = data?.code;
        error.limit = data?.limit;
        error.nextEligibleAt = data?.nextEligibleAt;
        throw error;
    }
    return data;
}

/**
 * Step 2: Confirms username change with step-up verification (OTP or password).
 */
export async function confirmUsernameChange(payload: {
    newUsername: string;
    operationId?: string;
    otp?: string;
    currentPassword?: string;
}): Promise<AccountChangeResult> {
    const res = await fetch(`${API_BASE}/username/change/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error: any = new Error(data?.message || "Failed to update username.");
        error.attemptsRemaining = data?.attemptsRemaining;
        throw error;
    }
    return data;
}
