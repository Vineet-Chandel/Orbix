/**
 * ORBIX PLATFORM VERIFICATION SERVICE
 * 
 * Orchestrates external coding platform account ownership verification.
 * 
 * Core Architectural Invariants:
 * 1. Two-Phase Non-Blocking Flow: External HTTP requests are ALWAYS performed OUTSIDE
 *    database transactions. Transactional commits hold row locks for sub-10ms.
 * 2. Concurrency-Safe: Re-selects challenge with FOR UPDATE in Stage 3 to eliminate race conditions.
 * 3. Constant-Time Crypto: Uses challengeCryptoService with timingSafeEqual.
 * 4. Zero Modulo Bias & No Plaintext Logging: Plaintext tokens are returned once at initiation
 *    and never stored or logged.
 * 5. Single Active Challenge & Handle Uniqueness: Strictly enforced at DB and application layer.
 * 6. Zero False Negatives on Outages: API timeouts and rate limits are returned as temporary
 *    service errors without consuming verification attempts.
 */

import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";
import { query } from "../../database/client.js";
import { generateChallengeToken, verifyCandidateMatch } from "./challengeCryptoService.js";
import { platformAdapterRegistry } from "./adapters/adapterRegistry.js";
import { GitHubAdapter } from "./adapters/githubAdapter.js";
import { checkVerificationSchemaStatus } from "./schemaCompatibility.js";
import { syncLeaderboardForUser } from "../../Routes/leaderboard/leaderboard.js";

export interface InitiateVerificationResult {
    success: boolean;
    challengeId?: string;
    portal: string;
    portalUsername: string;
    targetField?: string;
    displayFieldName?: string;
    token?: string; // Plaintext token returned ONLY once to caller
    tokenDisplayPrefix?: string;
    instructions?: string;
    profileSettingsUrl?: string | undefined;
    expiresAt?: Date | string;
    alreadyVerified?: boolean;
    verificationMethod?: string;
    verifiedAt?: Date | string;
    requiresOAuth?: boolean;
    oauthUrl?: string;
    error?: string;
    code?: string;
    supportedPlatforms?: string[];
}

export interface ConfirmVerificationResult {
    success: boolean;
    verified: boolean;
    portal: string;
    portalUsername: string;
    verificationMethod?: string;
    verifiedAt?: Date | string;
    attemptsRemaining?: number;
    error?: string;
    code?: string;
}

export class PlatformVerificationService {
    /**
     * Initiates ownership verification challenge for an external platform account.
     */
    public async initiate(
        userId: string,
        portal: string,
        portalUsername: string,
        requestedTargetField?: string
    ): Promise<InitiateVerificationResult> {
        const cleanPortal = String(portal || "").toLowerCase().trim();
        const cleanUsername = String(portalUsername || "").trim();

        if (!userId) {
            return { success: false, portal: cleanPortal, portalUsername: cleanUsername, code: 'AUTH_REQUIRED', error: 'Authentication required' };
        }

        if (!cleanPortal || !cleanUsername) {
            return { success: false, portal: cleanPortal, portalUsername: cleanUsername, code: 'INVALID_INPUT', error: 'Portal and portalUsername are required' };
        }

        // 1. Check platform support
        const adapter = platformAdapterRegistry.getAdapter(cleanPortal);
        if (!adapter) {
            const unsupported = platformAdapterRegistry.getUnsupportedResponse(cleanPortal);
            return {
                success: false,
                portal: cleanPortal,
                portalUsername: cleanUsername,
                code: unsupported.code,
                error: unsupported.error,
                supportedPlatforms: unsupported.supportedPlatforms,
            };
        }

        // 2. Schema check (Migration 069 readiness)
        const schema = await checkVerificationSchemaStatus();
        if (!schema.isMigrated) {
            return {
                success: false,
                portal: cleanPortal,
                portalUsername: cleanUsername,
                code: 'MIGRATION_REQUIRED',
                error: 'Verification engine requires Database Migration 069 to be applied.',
            };
        }

        // 3. Check if handle is already verified by another user
        const existingVerifiedRes = await query(`
            SELECT id, user_id, portal_username, verification_method, verified_at
            FROM public.user_links 
            WHERE LOWER(TRIM(portal)) = $1 
              AND LOWER(TRIM(portal_username)) = LOWER(TRIM($2)) 
              AND ownership_status = 'VERIFIED'
            LIMIT 1;
        `, [cleanPortal, cleanUsername]);

        if (existingVerifiedRes.rows.length > 0) {
            const ownerId = existingVerifiedRes.rows[0].user_id;
            if (ownerId === userId) {
                await this.refreshOwnershipAfterCommit(userId);
                return {
                    success: true,
                    portal: cleanPortal,
                    portalUsername: cleanUsername,
                    alreadyVerified: true,
                    verificationMethod: existingVerifiedRes.rows[0].verification_method,
                    verifiedAt: existingVerifiedRes.rows[0].verified_at,
                    error: `You have already verified ownership of ${adapter.displayName} handle '${cleanUsername}'.`,
                };
            } else {
                return {
                    success: false,
                    portal: cleanPortal,
                    portalUsername: cleanUsername,
                    code: 'ACCOUNT_ALREADY_VERIFIED',
                    error: `The ${adapter.displayName} handle '${cleanUsername}' is already verified by another Orbix user.`,
                };
            }
        }

        // 4. Special handling for OAuth platforms (GitHub)
        if (adapter.supportsOAuthVerification && adapter instanceof GitHubAdapter) {
            const oauthResult = await adapter.verifyOAuthOwnership(userId, cleanUsername);
            if (oauthResult.verified) {
                // Instantly confirm ownership
                await this.recordVerifiedOwnership(
                    userId,
                    cleanPortal,
                    oauthResult.resolvedHandle || cleanUsername,
                    'oauth',
                    { githubId: oauthResult.githubId }
                );

                return {
                    success: true,
                    portal: cleanPortal,
                    portalUsername: oauthResult.resolvedHandle || cleanUsername,
                    alreadyVerified: true,
                };
            } else {
                return {
                    success: false,
                    portal: cleanPortal,
                    portalUsername: cleanUsername,
                    requiresOAuth: true,
                    oauthUrl: '/api/auth/github',
                    code: oauthResult.errorCode || 'OAUTH_VERIFICATION_FAILED',
                    error: oauthResult.errorMessage || 'GitHub verification requires active GitHub OAuth identity.',
                };
            }
        }

        // 5. Handle Bio/Profile Token Challenge Platforms (LeetCode, Codeforces, HackerRank)
        // Check for existing pending challenge
        const pendingRes = await query(`
            SELECT id, portal_username, token_display_prefix, target_field, expires_at, attempts, max_attempts
            FROM public.platform_verification_challenges
            WHERE user_id = $1 AND LOWER(TRIM(portal)) = $2 AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1;
        `, [userId, cleanPortal]);

        if (pendingRes.rows.length > 0) {
            const active = pendingRes.rows[0];
            const isExpired = new Date(active.expires_at).getTime() <= Date.now();
            const attemptsExhausted = active.attempts >= active.max_attempts;

            if (!isExpired && !attemptsExhausted) {
                // If the user is requesting the SAME handle, cancel or renew
                // We mark old one failed to ensure single active challenge constraint in DB is satisfied
                await query(`
                    UPDATE public.platform_verification_challenges 
                    SET status = 'failed', last_error = 'Superseded by new challenge'
                    WHERE id = $1;
                `, [active.id]);
            } else {
                // Mark terminal state
                await query(`
                    UPDATE public.platform_verification_challenges 
                    SET status = $1 
                    WHERE id = $2;
                `, [isExpired ? 'expired' : 'failed', active.id]);
            }
        }

        // 6. Resolve target field
        const targetField = (requestedTargetField && adapter.supportedTargetFields.includes(requestedTargetField as any))
            ? requestedTargetField
            : adapter.defaultTargetField;

        // 7. Ensure a user_links record exists for binding
        let linkId: string | null = null;
        const linkRes = await query(`
            SELECT id FROM public.user_links 
            WHERE user_id = $1 AND LOWER(TRIM(portal)) = $2 
            LIMIT 1;
        `, [userId, cleanPortal]);

        if (linkRes.rows.length > 0) {
            linkId = linkRes.rows[0].id;
            // Update portal_username if changed
            await query(`
                UPDATE public.user_links 
                SET portal_username = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2;
            `, [cleanUsername, linkId]);
        } else {
            // Create initial connected_unverified link
            const userRow = await query(`SELECT username FROM public.users WHERE id = $1;`, [userId]);
            const orbixUsername = userRow.rows[0]?.username || null;
            const insertLink = await query(`
                INSERT INTO public.user_links (
                    user_id, username, portal, portal_username, link,
                    ownership_status, sync_status, verified
                ) VALUES (
                    $1, $2, $3, $4, $5, 'CONNECTED_UNVERIFIED', 'NOT_SYNCED', false
                ) RETURNING id;
            `, [userId, orbixUsername, cleanPortal, cleanUsername, `https://${cleanPortal}.com/${cleanUsername}`]);
            linkId = insertLink.rows[0].id;
        }

        // 8. Generate challenge token using Phase 1 CSPRNG
        const tokenBundle = generateChallengeToken();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

        // 9. Persist challenge (hash only; plaintext NEVER stored)
        const insertChallengeRes = await query(`
            INSERT INTO public.platform_verification_challenges (
                user_id, link_id, portal, portal_username, token_hash,
                token_display_prefix, target_field, status, attempts, max_attempts,
                expires_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, 'pending', 0, 5, $8
            ) RETURNING id;
        `, [
            userId,
            linkId,
            cleanPortal,
            cleanUsername,
            tokenBundle.tokenHash,
            tokenBundle.tokenDisplayPrefix,
            targetField,
            expiresAt,
        ]);

        const challengeId = insertChallengeRes.rows[0].id;
        const instructions = adapter.getInstructions(tokenBundle.plaintextToken, targetField);

        return {
            success: true,
            challengeId,
            portal: cleanPortal,
            portalUsername: cleanUsername,
            targetField: instructions.fieldName,
            displayFieldName: instructions.displayFieldName,
            token: tokenBundle.plaintextToken, // Returned ONLY once in response
            tokenDisplayPrefix: tokenBundle.tokenDisplayPrefix,
            instructions: instructions.instructions,
            profileSettingsUrl: instructions.profileSettingsUrl,
            expiresAt,
        };
    }

    /**
     * Confirms ownership verification challenge.
     * Implements Two-Phase Non-Blocking flow:
     * - Phase 1: Reads active challenge.
     * - Phase 2: Fetches external profile and extracts candidates OUTSIDE transaction.
     * - Phase 3: Short atomic transaction with row lock FOR UPDATE.
     */
    public async confirm(
        userId: string,
        portal: string,
        portalUsername?: string
    ): Promise<ConfirmVerificationResult> {
        const cleanPortal = String(portal || "").toLowerCase().trim();

        if (!userId) {
            return { success: false, verified: false, portal: cleanPortal, portalUsername: portalUsername || "", code: 'AUTH_REQUIRED', error: 'Authentication required' };
        }

        const adapter = platformAdapterRegistry.getAdapter(cleanPortal);
        if (!adapter) {
            return {
                success: false,
                verified: false,
                portal: cleanPortal,
                portalUsername: portalUsername || "",
                code: 'UNSUPPORTED_PLATFORM',
                error: `Platform '${cleanPortal}' is not supported for verification.`,
            };
        }

        // Schema check
        const schema = await checkVerificationSchemaStatus();
        if (!schema.isMigrated) {
            return {
                success: false,
                verified: false,
                portal: cleanPortal,
                portalUsername: portalUsername || "",
                code: 'MIGRATION_REQUIRED',
                error: 'Verification engine requires Database Migration 069.',
            };
        }

        // Special handling for GitHub OAuth
        if (adapter.supportsOAuthVerification && adapter instanceof GitHubAdapter) {
            const handle = portalUsername || "";
            const oauthResult = await adapter.verifyOAuthOwnership(userId, handle);
            if (oauthResult.verified) {
                await this.recordVerifiedOwnership(
                    userId,
                    cleanPortal,
                    oauthResult.resolvedHandle || handle,
                    'oauth',
                    { githubId: oauthResult.githubId }
                );
                return {
                    success: true,
                    verified: true,
                    portal: cleanPortal,
                    portalUsername: oauthResult.resolvedHandle || handle,
                    verificationMethod: 'oauth',
                    verifiedAt: new Date(),
                };
            } else {
                return {
                    success: false,
                    verified: false,
                    portal: cleanPortal,
                    portalUsername: handle,
                    code: oauthResult.errorCode || 'OAUTH_VERIFICATION_FAILED',
                    error: oauthResult.errorMessage || 'GitHub OAuth verification failed',
                };
            }
        }

        // =========================================================================
        // STAGE 1: READ ACTIVE CHALLENGE (OUTSIDE TRANSACTION)
        // =========================================================================
        const challengeRes = await query(`
            SELECT pvc.id, pvc.user_id, pvc.link_id, pvc.portal, pvc.portal_username, pvc.token_hash,
                   pvc.token_display_prefix, pvc.target_field, pvc.status, pvc.attempts, pvc.max_attempts, pvc.expires_at,
                   ul.portal_username AS current_link_username
            FROM public.platform_verification_challenges pvc
            LEFT JOIN public.user_links ul ON (ul.id = pvc.link_id OR (ul.user_id = pvc.user_id AND LOWER(TRIM(ul.portal)) = LOWER(TRIM(pvc.portal))))
            WHERE pvc.user_id = $1 AND LOWER(TRIM(pvc.portal)) = $2 AND pvc.status = 'pending'
            ORDER BY pvc.created_at DESC
            LIMIT 1;
        `, [userId, cleanPortal]);

        if (challengeRes.rows.length === 0) {
            return {
                success: false,
                verified: false,
                portal: cleanPortal,
                portalUsername: portalUsername || "",
                code: 'NO_ACTIVE_CHALLENGE',
                error: `No active verification challenge found for ${adapter.displayName}. Please initiate a challenge first.`,
            };
        }

        const challenge = challengeRes.rows[0];

        // Invariant Check: Verify that the challenge identity matches the active link identity
        if (challenge.current_link_username &&
            challenge.current_link_username.toLowerCase().trim() !== challenge.portal_username.toLowerCase().trim()) {
            // Identity was changed on user_links; invalidate the stale challenge
            await query(`
                UPDATE public.platform_verification_challenges 
                SET status = 'invalidated', last_error = 'Identity changed since challenge was created' 
                WHERE id = $1;
            `, [challenge.id]);

            return {
                success: false,
                verified: false,
                portal: cleanPortal,
                portalUsername: challenge.current_link_username,
                code: 'IDENTITY_CHANGED',
                error: `Verification challenge was created for handle '${challenge.portal_username}', but connected account is currently '${challenge.current_link_username}'. Please initiate a new challenge.`,
            };
        }

        // Check expiration
        if (new Date(challenge.expires_at).getTime() <= Date.now()) {
            await query(`UPDATE public.platform_verification_challenges SET status = 'expired' WHERE id = $1;`, [challenge.id]);
            return {
                success: false,
                verified: false,
                portal: cleanPortal,
                portalUsername: challenge.portal_username,
                code: 'CHALLENGE_EXPIRED',
                error: 'Verification challenge has expired. Please initiate a new challenge.',
            };
        }

        // Check attempts
        if (challenge.attempts >= challenge.max_attempts) {
            await query(`UPDATE public.platform_verification_challenges SET status = 'failed' WHERE id = $1;`, [challenge.id]);
            return {
                success: false,
                verified: false,
                portal: cleanPortal,
                portalUsername: challenge.portal_username,
                code: 'ATTEMPTS_EXHAUSTED',
                error: 'Maximum verification attempts exceeded. Please initiate a new challenge.',
            };
        }

        // =========================================================================
        // STAGE 2: EXTERNAL HTTP PROFILE FETCH & CANDIDATE MATCHING (OUTSIDE TRANSACTION)
        // =========================================================================
        const profileResult = await adapter.fetchProfile(challenge.portal_username);

        if (!profileResult.success) {
            // Handle temporary network/rate-limit errors without consuming attempts
            if (profileResult.errorCode === 'RATE_LIMITED' || profileResult.errorCode === 'NETWORK_ERROR') {
                return {
                    success: false,
                    verified: false,
                    portal: cleanPortal,
                    portalUsername: challenge.portal_username,
                    code: profileResult.errorCode,
                    error: `External platform connection issue: ${profileResult.errorMessage}`,
                };
            }

            if (profileResult.errorCode === 'NOT_FOUND') {
                return {
                    success: false,
                    verified: false,
                    portal: cleanPortal,
                    portalUsername: challenge.portal_username,
                    code: 'PROFILE_NOT_FOUND',
                    error: `External profile '${challenge.portal_username}' was not found on ${adapter.displayName}.`,
                };
            }
        }

        // Extract candidates
        const candidates = adapter.extractCandidates(profileResult, challenge.target_field);
        let tokenMatched = false;

        for (const candidate of candidates) {
            if (verifyCandidateMatch(candidate, challenge.token_hash)) {
                tokenMatched = true;
                break;
            }
        }

        // =========================================================================
        // STAGE 3: ATOMIC SUB-10MS TRANSACTIONAL COMMIT WITH ROW LOCK
        // =========================================================================
        await query('BEGIN;');
        try {
            // Re-select challenge with FOR UPDATE of pvc to prevent concurrent confirmation races
            const lockRes = await query(`
                SELECT pvc.id, pvc.status, pvc.attempts, pvc.max_attempts, ul.portal_username AS current_link_username 
                FROM public.platform_verification_challenges pvc
                LEFT JOIN public.user_links ul ON (ul.id = pvc.link_id OR (ul.user_id = pvc.user_id AND LOWER(TRIM(ul.portal)) = LOWER(TRIM(pvc.portal))))
                WHERE pvc.id = $1 
                FOR UPDATE OF pvc;
            `, [challenge.id]);

            if (lockRes.rows.length === 0 || lockRes.rows[0].status !== 'pending') {
                await query('ROLLBACK;');
                return {
                    success: false,
                    verified: false,
                    portal: cleanPortal,
                    portalUsername: challenge.portal_username,
                    code: 'CHALLENGE_ALREADY_CONSUMED',
                    error: 'Challenge is no longer active or was already processed.',
                };
            }

            // Invariant: verify identity has not mutated concurrently during external HTTP fetch
            const currentLinkUser = lockRes.rows[0].current_link_username;
            if (currentLinkUser && currentLinkUser.toLowerCase().trim() !== challenge.portal_username.toLowerCase().trim()) {
                await query('ROLLBACK;');
                return {
                    success: false,
                    verified: false,
                    portal: cleanPortal,
                    portalUsername: currentLinkUser,
                    code: 'IDENTITY_CHANGED',
                    error: 'Connected account identity was modified during verification.',
                };
            }

            const currentAttempts = lockRes.rows[0].attempts;
            const newAttempts = currentAttempts + 1;

            if (tokenMatched) {
                // Success: mark challenge verified and consumed
                await query(`
                    UPDATE public.platform_verification_challenges
                    SET status = 'verified',
                        consumed_at = CURRENT_TIMESTAMP,
                        last_attempt_at = CURRENT_TIMESTAMP,
                        attempts = $1
                    WHERE id = $2;
                `, [newAttempts, challenge.id]);

                // Update user_links to verified status (strictly scoped to user, portal AND verified handle)
                await query(`
                    UPDATE public.user_links
                    SET ownership_status = 'VERIFIED',
                        verified_at = CURRENT_TIMESTAMP,
                        verified_handle = $1,
                        verification_method = $2,
                        sync_status = 'SYNCED',
                        last_sync_status = 'valid',
                        last_sync_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $3 
                      AND LOWER(TRIM(portal)) = $4
                      AND LOWER(TRIM(portal_username)) = LOWER(TRIM($1));
                `, [challenge.portal_username, `profile_${challenge.target_field}`, userId, cleanPortal]);

                await query('COMMIT;');

                await this.refreshOwnershipAfterCommit(userId);

                return {
                    success: true,
                    verified: true,
                    portal: cleanPortal,
                    portalUsername: challenge.portal_username,
                    verificationMethod: `profile_${challenge.target_field}`,
                    verifiedAt: new Date(),
                };
            } else {
                // Token not found in external profile
                const isFinalFailure = newAttempts >= challenge.max_attempts;
                const newStatus = isFinalFailure ? 'failed' : 'pending';

                await query(`
                    UPDATE public.platform_verification_challenges
                    SET status = $1,
                        attempts = $2,
                        last_attempt_at = CURRENT_TIMESTAMP,
                        last_error = 'Verification token not found in target profile field'
                    WHERE id = $3;
                `, [newStatus, newAttempts, challenge.id]);

                await query('COMMIT;');

                const remaining = Math.max(0, challenge.max_attempts - newAttempts);
                return {
                    success: false,
                    verified: false,
                    portal: cleanPortal,
                    portalUsername: challenge.portal_username,
                    attemptsRemaining: remaining,
                    code: isFinalFailure ? 'MAX_ATTEMPTS_EXCEEDED' : 'TOKEN_NOT_FOUND',
                    error: isFinalFailure
                        ? `Maximum verification attempts (${challenge.max_attempts}) reached. Please initiate a new challenge.`
                        : `Verification token was not detected in your ${adapter.displayName} profile. Please ensure it is saved and retry (${remaining} attempt(s) remaining).`,
                };
            }
        } catch (err) {
            await query('ROLLBACK;');
            throw err;
        }
    }

    /**
     * Cancels an existing pending challenge for user and portal.
     */
    public async cancelChallenge(userId: string, portal: string): Promise<boolean> {
        const cleanPortal = String(portal || "").toLowerCase().trim();
        const res = await query(`
            UPDATE public.platform_verification_challenges 
            SET status = 'failed', last_error = 'Cancelled by user'
            WHERE user_id = $1 AND LOWER(TRIM(portal)) = $2 AND status = 'pending';
        `, [userId, cleanPortal]);

        return (res.rowCount ?? 0) > 0;
    }

    /**
     * Helper to atomically record verified ownership for OAuth or manual review.
     */
    public async recordVerifiedOwnership(
        userId: string,
        portal: string,
        verifiedHandle: string,
        method: string,
        metadata: Record<string, unknown> = {},
        dbClient?: { query: (text: string, params?: any[]) => Promise<any> }
    ): Promise<void> {
        const runQuery = dbClient ? dbClient.query.bind(dbClient) : query;
        const cleanPortal = portal.toLowerCase().trim();
        const cleanHandle = verifiedHandle.trim();

        // Check if user_links row exists
        const linkRes = await runQuery(`
            SELECT id FROM public.user_links 
            WHERE user_id = $1 AND LOWER(TRIM(portal)) = $2 
            LIMIT 1;
        `, [userId, cleanPortal]);

        if (linkRes.rows.length > 0) {
            await runQuery(`
                UPDATE public.user_links
                SET ownership_status = 'VERIFIED',
                    verified_handle = $1,
                    verified_at = CURRENT_TIMESTAMP,
                    verification_method = $2,
                    verification_metadata = $3::jsonb,
                    sync_status = 'SYNCED',
                    last_sync_status = 'valid',
                    last_sync_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4;
            `, [cleanHandle, method, JSON.stringify(metadata), linkRes.rows[0].id]);
        } else {
            const userRow = await runQuery(`SELECT username FROM public.users WHERE id = $1;`, [userId]);
            const orbixUsername = userRow.rows[0]?.username || null;
            await runQuery(`
                INSERT INTO public.user_links (
                    user_id, username, portal, portal_username, link,
                    ownership_status, sync_status, verified_handle, verified_at,
                    verification_method, verification_metadata
                ) VALUES (
                    $1, $2, $3, $4, $5, 'VERIFIED', 'SYNCED', $4, CURRENT_TIMESTAMP,
                    $6, $7::jsonb
                );
            `, [
                userId,
                orbixUsername,
                cleanPortal,
                cleanHandle,
                `https://${cleanPortal}.com/${cleanHandle}`,
                method,
                JSON.stringify(metadata),
            ]);
        }

        if (!dbClient) await this.refreshOwnershipAfterCommit(userId);
    }

    public async refreshOwnershipAfterCommit(userId: string): Promise<void> {
        // Finish invalidation before returning success, so immediate profile reads see the commit.
        try {
            const user = await query('SELECT username, email FROM public.users WHERE id = $1;', [userId]);
            await invalidateAllUserCaches({ id: userId, username: user.rows[0]?.username, email: user.rows[0]?.email });
        } catch {
            await invalidateAllUserCaches({ id: userId });
        }
        try { void syncLeaderboardForUser(userId).catch(() => {}); } catch { /* Best effort after commit. */ }
    }
}

export const platformVerificationService = new PlatformVerificationService();
