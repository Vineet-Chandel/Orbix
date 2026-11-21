/**
 * FRONTEND PLATFORM OWNERSHIP VERIFICATION DATA MODEL
 * Authoritative types mirroring Phase 1-3 backend contracts.
 */

export type OwnershipStatus = 'CONNECTED_UNVERIFIED' | 'VERIFIED' | 'REVOKED';

export type VerificationMethod = 'token' | 'oauth';

export type VerificationErrorCode =
    | 'INVALID_INPUT'
    | 'AUTH_REQUIRED'
    | 'UNSUPPORTED_PLATFORM'
    | 'ACCOUNT_ALREADY_VERIFIED'
    | 'NO_ACTIVE_CHALLENGE'
    | 'CHALLENGE_EXPIRED'
    | 'CHALLENGE_FAILED'
    | 'MAX_ATTEMPTS_EXCEEDED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'SERVICE_UNAVAILABLE'
    | 'NETWORK_ERROR'
    | 'SERVER_ERROR'
    | 'MIGRATION_REQUIRED'
    | 'OAUTH_VERIFICATION_FAILED'
    | 'IDENTITY_MISMATCH'
    | 'CLAIMED_BY_ANOTHER_USER';

export interface InitiateVerificationPayload {
    portal: string;
    portalUsername: string;
    targetField?: string;
}

export interface InitiateVerificationSuccessResponse {
    success: true;
    challengeId?: string;
    portal: string;
    portalUsername: string;
    targetField?: string;
    displayFieldName?: string;
    token?: string; // Plaintext token returned ONLY once by server
    tokenDisplayPrefix?: string;
    instructions?: string;
    profileSettingsUrl?: string;
    expiresAt?: string;
    alreadyVerified?: boolean;
    verificationMethod?: VerificationMethod | string;
    verifiedAt?: string;
}

export interface VerificationErrorResponse {
    success: false;
    code: VerificationErrorCode | string;
    message: string;
    error?: string;
    supportedPlatforms?: string[];
    requiresOAuth?: boolean;
    oauthUrl?: string;
    attemptsRemaining?: number;
    resetInSeconds?: number;
}

export type InitiateVerificationResponse =
    | InitiateVerificationSuccessResponse
    | VerificationErrorResponse;

export interface ConfirmVerificationPayload {
    portal: string;
    portalUsername?: string;
}

export interface ConfirmVerificationSuccessResponse {
    success: true;
    verified: true;
    portal: string;
    portalUsername: string;
    verificationMethod?: VerificationMethod | string;
    verifiedAt?: string;
    message?: string;
}

export type ConfirmVerificationResponse =
    | ConfirmVerificationSuccessResponse
    | VerificationErrorResponse;

export interface CancelVerificationPayload {
    portal: string;
}

export interface CancelVerificationResponse {
    success: boolean;
    cancelled?: boolean;
    message?: string;
}

/**
 * Transient in-memory state for an ongoing challenge.
 * Plaintext token is NEVER persisted to localStorage or sessionStorage.
 */
export interface ActiveVerificationChallenge {
    challengeId: string;
    portal: string;
    portalUsername: string;
    targetField: string;
    displayFieldName: string;
    token: string;
    tokenDisplayPrefix: string;
    instructions: string;
    profileSettingsUrl?: string;
    expiresAt: string; // ISO String
}

export interface PlatformVerificationError extends Error {
    code: VerificationErrorCode | string;
    status: number;
    resetInSeconds?: number;
    attemptsRemaining?: number;
    requiresOAuth?: boolean;
    oauthUrl?: string;
    supportedPlatforms?: string[];
}
