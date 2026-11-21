/**
 * ORBIX PLATFORM ACCOUNT OWNERSHIP VERIFICATION TYPES
 * Canonical type definitions for external coding platform ownership verification,
 * challenge lifecycle, and dual-state tracking.
 */

export const OWNERSHIP_STATUSES = [
    'NOT_CONNECTED',
    'CONNECTED_UNVERIFIED',
    'VERIFICATION_PENDING',
    'VERIFICATION_FAILED',
    'VERIFIED',
    'REVOKED',
] as const;

export type OwnershipStatus = typeof OWNERSHIP_STATUSES[number];

export const SYNC_STATUSES = [
    'NOT_SYNCED',
    'SYNCING',
    'SYNCED',
    'SYNC_FAILED',
    'PROFILE_UNAVAILABLE',
] as const;

export type SyncStatus = typeof SYNC_STATUSES[number];

export const CHALLENGE_STATUSES = [
    'pending',
    'verified',
    'failed',
    'expired',
] as const;

export type ChallengeStatus = typeof CHALLENGE_STATUSES[number];

export const VERIFICATION_METHODS = [
    'profile_bio',
    'profile_name',
    'profile_location',
    'oauth',
    'manual_review',
] as const;

export type VerificationMethod = typeof VERIFICATION_METHODS[number];

export const SUPPORTED_PORTALS = [
    'leetcode',
    'codeforces',
    'codechef',
    'hackerrank',
    'geeksforgeeks',
    'github',
] as const;

export type SupportedPortal = typeof SUPPORTED_PORTALS[number];

/**
 * Challenge entity stored in public.platform_verification_challenges
 */
export interface PlatformVerificationChallenge {
    id: string;
    user_id: string;
    link_id?: string | null;
    portal: string;
    portal_username: string;
    token_hash: string;
    token_display_prefix: string;
    target_field: string;
    status: ChallengeStatus;
    attempts: number;
    max_attempts: number;
    expires_at: Date | string;
    consumed_at?: Date | string | null;
    last_attempt_at?: Date | string | null;
    last_error?: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

/**
 * Representation of a user_links record with dual-state ownership and sync metadata
 */
export interface UserLinkOwnership {
    id?: string;
    user_id: string;
    username?: string | null;
    portal: string;
    portal_username: string;
    link: string;
    raw_input?: string | null;
    ownership_status: OwnershipStatus;
    sync_status: SyncStatus;
    verified: boolean; // Compatibility projection: strictly true <=> ownership_status === 'VERIFIED'
    legacy_unverified_at?: Date | string | null;
    verified_at?: Date | string | null;
    verified_handle?: string | null;
    verification_method?: VerificationMethod | string | null;
    verification_metadata?: Record<string, unknown> | null;
    display_name?: string | null;
    avatar_url?: string | null;
    stats?: unknown;
    is_public?: boolean;
    last_sync_status?: string | null;
    last_sync_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    last_error?: string | null;
    snapshot?: Record<string, unknown> | null;
    retry_count?: number;
}

/**
 * Return type from challenge crypto generation
 */
export interface ChallengeTokenResult {
    /** Plaintext token provided to user ONLY at challenge initiation. NEVER persisted or logged. */
    plaintextToken: string;
    /** SHA-256 lowercase hex hash of the plaintext token. Safe for database persistence. */
    tokenHash: string;
    /** Human-safe prefix for audit logs and UI display (e.g. 'orbix-v-abcd'). */
    tokenDisplayPrefix: string;
}

/**
 * Result of validating candidate tokens in profile text against expected hash
 */
export interface ValidationResult {
    matched: boolean;
    matchedCandidate?: string;
}
