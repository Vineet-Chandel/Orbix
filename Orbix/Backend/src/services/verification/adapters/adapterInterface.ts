/**
 * ORBIX PLATFORM VERIFICATION - ADAPTER INTERFACE
 * 
 * Formal contract for platform verification adapters.
 * Isolates all external HTTP fetching, parsing, field extraction, and error handling.
 */

import type { SupportedPortal } from "../../../types/verification.js";

export type AdapterErrorCode =
    | 'NOT_FOUND'
    | 'RATE_LIMITED'
    | 'NETWORK_ERROR'
    | 'INVALID_RESPONSE'
    | 'AUTH_REQUIRED'
    | 'UNSUPPORTED';

export interface AdapterFetchResult {
    success: boolean;
    portal: SupportedPortal;
    handle: string;
    targetFieldsContent: Record<string, string | null | undefined>;
    rawProfile?: unknown;
    errorCode?: AdapterErrorCode;
    errorMessage?: string;
}

export interface VerificationInstructions {
    fieldName: string;
    displayFieldName: string;
    instructions: string;
    profileSettingsUrl?: string;
}

export interface PlatformAdapter {
    readonly portal: SupportedPortal;
    readonly displayName: string;
    readonly defaultTargetField: string;
    readonly supportedTargetFields: readonly string[];
    readonly supportsChallengeVerification: boolean;
    readonly supportsOAuthVerification: boolean;

    /**
     * Retrieves the external user profile and extracts target verification fields.
     * MUST NOT be called within a database transaction!
     */
    fetchProfile(handle: string): Promise<AdapterFetchResult>;

    /**
     * Extracts challenge candidate tokens from retrieved profile fields.
     */
    extractCandidates(fetchResult: AdapterFetchResult, targetField?: string): string[];

    /**
     * Provides user-facing instructions on where and how to place the challenge token.
     */
    getInstructions(token: string, targetField?: string): VerificationInstructions;
}
